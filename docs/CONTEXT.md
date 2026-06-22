# Domain Glossary (CONTEXT)

This document establishes the shared language for the project. All documentation, code, and discussions should use these terms consistently. Terms are grouped by domain.

## Ticketing Domain

| Term | Definition |
|------|------------|
| **Primary sale** | The first sale of a ticket, from the organizer/producer directly to a buyer. |
| **Secondary market** | Resale of a ticket between users (buyer-to-buyer), after the primary sale. |
| **Cambismo** | The unauthorized, speculative resale of tickets at inflated prices. The core problem this platform solves. |
| **Face value** | The original price of a ticket as set by the organizer during the primary sale. |
| **Price cap (resale ceiling)** | A programmable maximum price enforceable on-chain, limiting how much a ticket can be resold for (e.g., 120% of face value). |
| **Royalty** | A percentage of a secondary-market sale that is automatically routed back to the organizer. Configured per-event. |
| **Door staff / Validator** | The physical team at the event entrance responsible for scanning tickets and admitting attendees. |
| **Burn** | The act of permanently invalidating a ticket NFT after it has been used for entry. A burned ticket cannot be reused or resold. |
| **Anti-print QR** | A dynamic QR code that rotates on a time interval and is cryptographically bound to the current holder's wallet, preventing screenshot-based fraud. |

## Blockchain Domain

| Term | Definition |
|------|------------|
| **NFT (Non-Fungible Token)** | A unique, non-interchangeable token on a blockchain. In this project, each NFT represents a single ticket. |
| **Mint / Minting** | The process of creating a new NFT on the blockchain. The Minting Engine converts an event configuration into minted ticket NFTs. |
| **Smart contract** | Self-executing code deployed on a blockchain that enforces rules (price caps, royalties, transfer restrictions) without an intermediary. |
| **On-chain** | Logic or data that lives directly on the blockchain (smart contracts, token ownership, transfer history). |
| **Off-chain** | Logic or data that lives in traditional systems (web frontend, backend servers, databases) and interacts with the blockchain as needed. |
| **Wallet** | A cryptographic identity that holds tokens. Identified by an address (e.g., `0x...`). |
| **Custodial wallet (invisible wallet)** | A wallet whose private keys are managed by the platform on behalf of the user. The user authenticates with email/password, not a seed phrase. |
| **Seed phrase** | A 12-24 word recovery key for a self-custody wallet. This platform hides seed phrases from end users (Web2.5 approach). |
| **Gas** | The fee paid to execute a transaction on the blockchain. |
| **ERC-721** | The Ethereum token standard for non-fungible tokens (one-of-a-kind). Candidate for the ticket NFT standard. |
| **ERC-1155** | The Ethereum multi-token standard (supports both fungible and non-fungible in one contract). Candidate for the ticket NFT standard. |
| **ERC-2981** | The Ethereum royalty standard. Enables a contract to declare a royalty percentage that marketplaces can query and enforce. |
| **Hardhat** | A development framework for Ethereum smart contracts. Provides local dev network, compilation, testing, and deployment tooling. |

## Platform-Specific Terms

| Term | Definition |
|------|------------|
| **Web2.5** | An architectural approach that blends Web2 UX (email login, FIAT payments) with Web3 infrastructure (blockchain ownership, smart contracts). Users interact without knowing they are using a blockchain. |
| **Minting Engine** | The system component that takes an organizer's event configuration and deploys a smart contract + mints the corresponding NFT tickets. |
| **Invisible wallet** | Synonym for custodial wallet in this project. The user never sees a wallet address or seed phrase. |
| **FIAT-to-crypto conversion** | The backend process of accepting a FIAT payment (Pix, credit card) and executing the equivalent blockchain transaction on the user's behalf. |
| **Dynamic QR** | A QR code payload that changes at a fixed interval (e.g., every 10 seconds) and is signed by the current ticket holder's wallet. Validation requires both the current payload and the on-chain ownership state. |
| **Scanner app** | The mobile application used by door staff to read dynamic QR codes and verify ticket validity against the blockchain. |

## Conventions

- **Ticket** = an NFT held in a wallet, representing the right to enter an event.
- **Listing** = an active offer to sell a ticket on the secondary market.
- **Validation** = the act of scanning a ticket at the door and confirming entry (which triggers a burn).
- **Organizer / Producer** are used interchangeably and refer to the same persona.
- **Buyer / Fan** are used interchangeably and refer to the same persona.
- **Validator / Door Staff / Staff** are used interchangeably and refer to the same persona.
