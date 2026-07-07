// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from '@openzeppelin/contracts/access/Ownable.sol';
import {TicketNFT} from './TicketNFT.sol';

contract TicketFactory is Ownable {
    struct TierInput { uint256 tierId; bytes32 tierReference; uint256 faceValue; uint256 configuredSupply; }

    address public platformOrchestrator;
    address[] public eventContracts;
    mapping(bytes32 => address) public ticketContractsByEventReference;

    event PlatformOrchestratorUpdated(address indexed previousOrchestrator, address indexed newOrchestrator);
    event EventContractCreated(bytes32 indexed eventReference, address indexed ticketContract, address indexed organizer, uint256 tierCount, uint256 totalConfiguredSupply);

    constructor(address owner_, address orchestrator_) Ownable(owner_) { require(orchestrator_ != address(0), 'orchestrator'); platformOrchestrator = orchestrator_; }

    function transferOwnership(address newOwner) public override onlyOwner { super.transferOwnership(newOwner); }
    function renounceOwnership() public pure override { revert('disabled'); }

    function setPlatformOrchestrator(address newOrchestrator) external onlyOwner { require(newOrchestrator != address(0), 'orchestrator'); emit PlatformOrchestratorUpdated(platformOrchestrator, newOrchestrator); platformOrchestrator = newOrchestrator; }

    function createEvent(
        address organizer,
        address marketplace,
        bytes32 eventReference,
        uint256 maxResalePriceMultiplier,
        uint256 royaltyPercentage,
        string memory baseURI,
        TierInput[] memory tiers
    ) external returns (address ticketContract) {
        require(msg.sender == platformOrchestrator, 'orchestrator');
        require(ticketContractsByEventReference[eventReference] == address(0), 'duplicateEvent');
        TicketNFT.TierInput[] memory ticketTiers = new TicketNFT.TierInput[](tiers.length);
        uint256 totalConfiguredSupply;
        for (uint256 i; i < tiers.length; ++i) { ticketTiers[i] = TicketNFT.TierInput(tiers[i].tierId, tiers[i].tierReference, tiers[i].faceValue, tiers[i].configuredSupply); totalConfiguredSupply += tiers[i].configuredSupply; }
        TicketNFT nft = new TicketNFT(organizer, marketplace, eventReference, maxResalePriceMultiplier, royaltyPercentage, baseURI, ticketTiers);
        ticketContract = address(nft);
        ticketContractsByEventReference[eventReference] = ticketContract;
        eventContracts.push(ticketContract);
        emit EventContractCreated(eventReference, ticketContract, organizer, tiers.length, totalConfiguredSupply);
    }

    function eventContractsLength() external view returns (uint256) { return eventContracts.length; }
}
