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

**Recurring Series**:
A money movement the user declared as repeating, always seeded from one real transaction. Numra never infers a series on its own.
_Avoid_: Subscription, rule, pattern

**Occurrence**:
A single expected instance of a recurring series on a given date. Occurrences are projected from the series definition at read time and are never stored.
_Avoid_: Instance, expected transaction

**Received**:
The state of an occurrence that a real transaction has been matched to. Matching is by counterparty and date proximity, never by amount, so an unusual amount still counts as received.
_Avoid_: Paid, checked, confirmed
