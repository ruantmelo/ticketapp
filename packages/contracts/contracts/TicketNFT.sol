// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC721} from '@openzeppelin/contracts/token/ERC721/ERC721.sol';
import {ERC2981} from '@openzeppelin/contracts/token/common/ERC2981.sol';
import {Ownable} from '@openzeppelin/contracts/access/Ownable.sol';
import {Strings} from '@openzeppelin/contracts/utils/Strings.sol';

contract TicketNFT is ERC721, ERC2981, Ownable {
    using Strings for uint256;

    struct Tier {
        bytes32 tierReference;
        uint256 faceValue;
        uint256 configuredSupply;
        uint256 mintedSupply;
        bool exists;
    }

    struct TierInput {
        uint256 tierId;
        bytes32 tierReference;
        uint256 faceValue;
        uint256 configuredSupply;
    }

    uint256 public constant MAX_BATCH_SIZE = 100;

    bytes32 public immutable eventReference;
    address public immutable organizer;
    address public immutable marketplace;
    uint256 public immutable maxResalePriceMultiplier;
    uint256 public immutable royaltyPercentage;
    string private _baseTokenURI;

    bool public mintingFinalized;
    uint256 private _nextTokenId = 1;

    mapping(uint256 => uint256) private _tokenTierIds;
    mapping(uint256 => Tier) private _tiers;
    uint256[] private _tierIds;
    mapping(address => bool) public validators;

    event TicketsMintedBatch(bytes32 indexed eventReference, uint256 indexed tierId, uint256 fromTokenId, uint256 toTokenId, uint256 quantity, address indexed to);
    event ValidatorAdded(address indexed validator);
    event ValidatorRemoved(address indexed validator);
    event MintingFinalized();

    constructor(
        address organizer_,
        address marketplace_,
        bytes32 eventReference_,
        uint256 maxResalePriceMultiplier_,
        uint256 royaltyPercentage_,
        string memory baseTokenURI_,
        TierInput[] memory tiers_
    ) ERC721('TicketNFT', 'TICKET') Ownable(organizer_) {
        require(organizer_ != address(0), 'organizer');
        require(marketplace_ != address(0), 'marketplace');
        require(eventReference_ != bytes32(0), 'eventReference');
        require(bytes(baseTokenURI_).length > 0, 'baseURI');
        require(tiers_.length > 0, 'tiers');
        require(maxResalePriceMultiplier_ >= 100 && maxResalePriceMultiplier_ <= 150, 'priceCap');
        require(royaltyPercentage_ <= 1000, 'royalty');

        organizer = organizer_;
        marketplace = marketplace_;
        eventReference = eventReference_;
        maxResalePriceMultiplier = maxResalePriceMultiplier_;
        royaltyPercentage = royaltyPercentage_;
        _baseTokenURI = baseTokenURI_;

        for (uint256 i; i < tiers_.length; ++i) {
            TierInput memory tier = tiers_[i];
            require(tier.tierId != 0, 'tierId');
            require(tier.tierReference != bytes32(0), 'tierReference');
            require(tier.faceValue != 0, 'faceValue');
            require(tier.configuredSupply != 0, 'configuredSupply');
            require(!_tiers[tier.tierId].exists, 'duplicateTier');
            _tiers[tier.tierId] = Tier({
                tierReference: tier.tierReference,
                faceValue: tier.faceValue,
                configuredSupply: tier.configuredSupply,
                mintedSupply: 0,
                exists: true
            });
            _tierIds.push(tier.tierId);
        }

        _setDefaultRoyalty(organizer_, uint96(royaltyPercentage_));
    }

    function transferOwnership(address) public pure override { revert('disabled'); }
    function renounceOwnership() public pure override { revert('disabled'); }

    function mintBatch(uint256 tierId, uint256 quantity) external onlyOwner {
        require(!mintingFinalized, 'finalized');
        require(quantity > 0 && quantity <= MAX_BATCH_SIZE, 'batch');
        Tier storage tier = _tiers[tierId];
        require(tier.exists, 'tier');
        require(tier.mintedSupply + quantity <= tier.configuredSupply, 'supply');

        uint256 fromTokenId = _nextTokenId;
        for (uint256 i; i < quantity; ++i) {
            _safeMint(organizer, _nextTokenId);
            _tokenTierIds[_nextTokenId] = tierId;
            unchecked { ++_nextTokenId; }
        }
        tier.mintedSupply += quantity;
        emit TicketsMintedBatch(eventReference, tierId, fromTokenId, _nextTokenId - 1, quantity, organizer);
    }

    function finalizeMinting() external onlyOwner {
        require(!mintingFinalized, 'finalized');
        require(_tierIds.length > 0, 'tiers');
        for (uint256 i; i < _tierIds.length; ++i) {
            Tier storage tier = _tiers[_tierIds[i]];
            require(tier.mintedSupply == tier.configuredSupply, 'incomplete');
        }
        mintingFinalized = true;
        emit MintingFinalized();
    }

    function addValidator(address validator) external onlyOwner { require(validator != address(0), 'validator'); validators[validator] = true; emit ValidatorAdded(validator); }
    function removeValidator(address validator) external onlyOwner { validators[validator] = false; emit ValidatorRemoved(validator); }
    function burn(uint256 tokenId) external {
        require(mintingFinalized, 'finalized');
        require(validators[msg.sender], 'validator');
        _update(address(0), tokenId, msg.sender);
        delete _tokenTierIds[tokenId];
    }

    function tierOf(uint256 tokenId) external view returns (uint256) { _requireOwned(tokenId); return _tokenTierIds[tokenId]; }
    function faceValue(uint256 tokenId) public view returns (uint256) { _requireOwned(tokenId); return _tiers[_tokenTierIds[tokenId]].faceValue; }
    function maxResalePrice(uint256 tokenId) external view returns (uint256) { return (faceValue(tokenId) * maxResalePriceMultiplier) / 100; }

    function tokenURI(uint256 tokenId) public view override returns (string memory) { _requireOwned(tokenId); return string.concat(_baseTokenURI, tokenId.toString()); }

    function _baseURI() internal view override returns (string memory) { return _baseTokenURI; }

    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from == address(0)) {
            require(!mintingFinalized, 'finalized');
            require(to == organizer, 'mintToOrganizer');
            return super._update(to, tokenId, auth);
        }
        if (to == address(0)) {
            require(mintingFinalized, 'finalized');
            require(validators[auth], 'validator');
            return super._update(to, tokenId, auth);
        }
        require(mintingFinalized, 'finalized');
        if (from == organizer) {
            require(auth == organizer, 'primarySaleAuth');
            return super._update(to, tokenId, auth);
        }
        require(auth == marketplace, 'marketplace');
        return super._update(to, tokenId, auth);
    }

    function _isAuthorized(address owner, address spender, uint256 tokenId) internal view override returns (bool) {
        if (toBurnAuthorization(owner, spender)) {
            return true;
        }
        return super._isAuthorized(owner, spender, tokenId);
    }

    function toBurnAuthorization(address owner, address spender) private view returns (bool) {
        return owner != address(0) && mintingFinalized && validators[spender];
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC2981) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
