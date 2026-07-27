# Numra Finance

Numra maintains a personal ledger synchronized from connected financial institutions while preserving the user's own organization of that ledger.

## Language

**Provider Name**:
The bank-supplied name of a bank account. It may change when Numra renews or synchronizes the bank connection.
_Avoid_: Custom name, display name

**Custom Name**:
An optional name assigned to a bank account by the Numra user. It takes precedence over the provider name and is never changed by bank synchronization.
_Avoid_: Nickname, provider name

**Display Name**:
The resolved bank account name shown by Numra: the custom name when present, otherwise the provider name, otherwise “Unnamed account.”
_Avoid_: Account name
