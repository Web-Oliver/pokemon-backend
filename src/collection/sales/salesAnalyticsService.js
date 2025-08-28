/**
 * Calculate sales summary statistics
 */
function calculateSalesSummary(salesData) {
  if (salesData.length === 0) {
    return {
      totalRevenue: 0,
      totalCost: 0,
      totalProfit: 0,
      totalItems: 0,
      averageSalePrice: 0,
      averageProfit: 0,
      profitMargin: 0
    };
  }

  const totalSales = salesData.reduce((sum, item) => sum + parseFloat(item.saleDetails?.actualSoldPrice || 0), 0);

  const totalCost = salesData.reduce((sum, item) => sum + parseFloat(item.myPrice || 0), 0);

  const totalProfit = totalSales - totalCost;
  const totalItems = salesData.length;
  const averageSalePrice = totalSales / totalItems;
  const averageProfit = totalProfit / totalItems;
  const profitMargin = totalSales > 0 ? (totalProfit / totalSales) * 100 : 0;

  return {
    totalRevenue: Math.round(totalSales * 100) / 100,
    totalCost: Math.round(totalCost * 100) / 100,
    totalProfit: Math.round(totalProfit * 100) / 100,
    totalItems,
    averageSalePrice: Math.round(averageSalePrice * 100) / 100,
    averageProfit: Math.round(averageProfit * 100) / 100,
    profitMargin: Math.round(profitMargin * 100) / 100
  };
}

/**
 * Generate graph data for sales analytics
 */
function generateGraphData(salesData) {
  const salesByDate = new Map();

  salesData.forEach((item) => {
    if (!item.saleDetails?.dateSold) {
      return;
    }

    const date = new Date(item.saleDetails.dateSold).toISOString().split('T')[0];
    // FIX: Use consistent field name - actualSoldPrice instead of salePrice
    const salePrice = parseFloat(item.saleDetails.actualSoldPrice || 0);
    const cost = parseFloat(item.myPrice || 0);
    const profit = salePrice - cost;

    if (salesByDate.has(date)) {
      const existing = salesByDate.get(date);

      existing.sales += salePrice;
      existing.profit += profit;
      existing.itemCount += 1;
    } else {
      salesByDate.set(date, {
        sales: salePrice,
        profit,
        itemCount: 1
      });
    }
  });

  return Array.from(salesByDate.entries())
    .map(([date, data]) => ({
      date,
      sales: Math.round(data.sales * 100) / 100,
      profit: Math.round(data.profit * 100) / 100,
      itemCount: data.itemCount
    }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

export {
  calculateSalesSummary,
  generateGraphData
};
export default calculateSalesSummary; ;
