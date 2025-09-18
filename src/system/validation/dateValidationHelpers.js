/**
 * Date validation helpers
 */

export function validateDateRange(startDate, endDate) {
    if (!startDate || !endDate) {
        throw new Error('Start date and end date are required');
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw new Error('Invalid date format');
    }

    if (start > end) {
        throw new Error('Start date cannot be after end date');
    }

    return { startDate: start, endDate: end };
}
