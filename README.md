## Sample Squid to Cosmos

This is a simple demo to send AVAX via squid to ComosHub.
Receiver address is currently hardcoded

## Setup

### Requiements

Node 16
yarn

### How to run

Install dependencies using yarn

```bash
yarn install
```

Copy env.example

```bash
cp .env.example .env
```

Update environment files with privateKey

```bash
privateKey=0x ...
targetAddress="EVM or Cosmos address";
```

Execute test

```
yarn test
```
