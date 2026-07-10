// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC721} from '@openzeppelin/contracts/token/ERC721/IERC721.sol';
import {IERC2981} from '@openzeppelin/contracts/interfaces/IERC2981.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {ReentrancyGuard} from '@openzeppelin/contracts/utils/ReentrancyGuard.sol';

interface ITicketNFTView {
    function maxResalePrice(uint256 tokenId) external view returns (uint256);
}

contract TicketMarketplace is ReentrancyGuard {
    struct Listing {
        address ticketContract;
        uint256 tokenId;
        address seller;
        uint256 price;
        bool active;
    }

    IERC20 public immutable paymentToken;

    uint256 private _nextListingId = 1;
    mapping(uint256 => Listing) private _listings;
    mapping(address => mapping(uint256 => uint256)) private _activeListingIdByToken;

    event ListingCreated(uint256 indexed listingId, address indexed ticketContract, uint256 indexed tokenId, address seller, uint256 price);
    event Sale(uint256 indexed listingId, address indexed ticketContract, uint256 indexed tokenId, address buyer, address seller, uint256 price, uint256 royaltyAmount);
    event ListingCancelled(uint256 indexed listingId);

    constructor(address paymentToken_) {
        require(paymentToken_ != address(0), 'paymentToken');
        paymentToken = IERC20(paymentToken_);
    }

    function list(address ticketContract, uint256 tokenId, uint256 price) external nonReentrant returns (uint256 listingId) {
        require(price > 0, 'price');
        require(_activeListingIdByToken[ticketContract][tokenId] == 0, 'alreadyListed');
        require(price <= ITicketNFTView(ticketContract).maxResalePrice(tokenId), 'priceCap');

        IERC721(ticketContract).transferFrom(msg.sender, address(this), tokenId);

        listingId = _nextListingId++;
        _listings[listingId] = Listing({ ticketContract: ticketContract, tokenId: tokenId, seller: msg.sender, price: price, active: true });
        _activeListingIdByToken[ticketContract][tokenId] = listingId;
        emit ListingCreated(listingId, ticketContract, tokenId, msg.sender, price);
    }

    function buy(uint256 listingId) external nonReentrant {
        Listing storage listing = _listings[listingId];
        require(listing.active, 'inactive');
        listing.active = false;
        _activeListingIdByToken[listing.ticketContract][listing.tokenId] = 0;

        (address royaltyReceiver, uint256 royaltyAmount) = IERC2981(listing.ticketContract).royaltyInfo(listing.tokenId, listing.price);
        require(royaltyAmount <= listing.price, 'royalty');
        uint256 sellerProceeds = listing.price - royaltyAmount;

        require(paymentToken.transferFrom(msg.sender, listing.seller, sellerProceeds), 'payProceeds');
        if (royaltyAmount > 0) {
            require(paymentToken.transferFrom(msg.sender, royaltyReceiver, royaltyAmount), 'payRoyalty');
        }

        IERC721(listing.ticketContract).transferFrom(address(this), msg.sender, listing.tokenId);
        emit Sale(listingId, listing.ticketContract, listing.tokenId, msg.sender, listing.seller, listing.price, royaltyAmount);
    }

    function cancelListing(uint256 listingId) external nonReentrant {
        Listing storage listing = _listings[listingId];
        require(listing.active, 'inactive');
        require(listing.seller == msg.sender, 'notSeller');
        listing.active = false;
        _activeListingIdByToken[listing.ticketContract][listing.tokenId] = 0;

        IERC721(listing.ticketContract).transferFrom(address(this), listing.seller, listing.tokenId);
        emit ListingCancelled(listingId);
    }

    function getListing(uint256 listingId) external view returns (address ticketContract, uint256 tokenId, address seller, uint256 price, bool active) {
        Listing storage listing = _listings[listingId];
        return (listing.ticketContract, listing.tokenId, listing.seller, listing.price, listing.active);
    }

    function isListed(address ticketContract, uint256 tokenId) external view returns (bool) {
        return _activeListingIdByToken[ticketContract][tokenId] != 0;
    }
}
