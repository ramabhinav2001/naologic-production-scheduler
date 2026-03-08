# Shift Boundary Calculation

## Prompt Used

How should a scheduling system calculate job completion times when work orders span across shift boundaries?

Example:
A job requires 120 minutes of work but starts at 4 PM when the shift ends at 5 PM.

## AI-Assisted Ideas

The suggested solution was to calculate **working time instead of elapsed time**.

Key concepts:

- Work pauses when the shift ends
- Work resumes at the next available shift
- Maintenance windows must also be skipped

## Implementation

The `date-utils.ts` file implements:

- detecting if a time falls within a shift
- finding the next available shift start
- skipping maintenance windows
- calculating working minutes while respecting shift constraints

This ensures work orders are executed only during valid working periods.