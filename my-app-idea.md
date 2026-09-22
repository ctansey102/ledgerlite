# App Name

LedgerLite

## One-Sentence Summary

LedgerLite is a lightweight double-entry bookkeeping app for small business owners and accounting students who want to record journal entries and generate accurate financial statements without the overhead of full-featured software like QuickBooks or complicated ERP systems.

## The Problem

Small business owners and accounting students often need a simple way to record transactions and see how they flow through to the financial statements, but existing tools are either too complex (full accounting suites with steep learning curves and unnecessary modules) or too simplistic (spreadsheets with no built-in controls, audit trail, or automatic statement generation). LedgerLite fills that gap: it enforces proper double-entry bookkeeping while staying easy to use and transparent about how each entry affects the books.

## User Types

- **Registered users** — can create, view, and manage their own journal entries and financial statements
- **Administrators** — can view entries made by all users on an account and see who entered each transaction (useful for firms or teams with multiple bookkeepers)

## Core Features

- Record journal entries with debits and credits, validated to ensure they balance
- Search and browse the chart of accounts, with drill-down into the general ledger for any account
- View a trial balance that links back to the underlying journal entries, including who entered each one
- Generate a balance sheet and income statement (maybe statement of cash flows?) for a selected date range
- Track which user entered each transaction for accountability and review

## What Users See

### Screen 1: Journal Entry
Users enter a transaction date, description, and one or more debit/credit lines tied to accounts from the chart of accounts. The screen validates that total debits equal total credits before the entry can be saved, and shows the user's name and timestamp on submission.

### Screen 2: Chart of Accounts & Trial Balance
A searchable list of all accounts (assets, liabilities, equity, revenue, expenses) showing current balances. Clicking an account drills down into its general ledger, listing every journal entry affecting that account, who entered it, and the running balance.

### Screen 3: Financial Statements
Users select a date range or period, and the app generates a balance sheet, income statement, and maybe a statement of cash flows prepared with the indirect method pulled directly from the underlying ledger data. Each line item can be clicked to see the journal entries that make it up.

## Example Scenario

Maria owns a small landscaping business and uses LedgerLite to keep her books straight. On Monday, she logs in and records a journal entry for a $1,200 client payment: a debit to Cash and a credit to Service Revenue. The app confirms the entry balances and saves it, tagging it with her name and the date.

Later that week, Maria wants to double-check her cash balance, so she goes to the Chart of Accounts screen, searches for "Cash," and drills into the general ledger to see every transaction affecting that account this month, including Monday's client payment.

At month-end, Maria selects "This Month" on the Financial Statements screen. LedgerLite generates her income statement, showing the $1,200 in revenue alongside her expenses, her balance sheet, and the statement of cash flows showing the updated cash balance. She clicks on the revenue line to confirm it traces back to the entries she recorded, giving her confidence the numbers are right before she reviews them with her tax preparer.