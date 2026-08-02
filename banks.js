/*
  Nomad Wealth — Country & Bank data
  A curated list of major banks per country.
  Purely a labeling helper: users pick their country, then their bank,
  so they can see how much money they hold in each institution.
  This does NOT connect to any real bank. It is display data only.
*/
window.NOMAD_WEALTH_BANKS = {
  "Bangladesh": ["BRAC Bank", "Dutch-Bangla Bank", "Islami Bank Bangladesh", "City Bank", "Eastern Bank (EBL)", "Sonali Bank", "Standard Chartered BD", "bKash", "Nagad", "Rocket"],
  "Russia": ["Sberbank", "T-Bank (Tinkoff)", "VTB", "Alfa-Bank", "Gazprombank", "Raiffeisen Russia", "Ozon Bank", "Yandex Pay"],
  "United States": ["Chase", "Bank of America", "Wells Fargo", "Citibank", "Capital One", "US Bank", "PNC", "Payoneer", "PayPal", "Wise"],
  "United Kingdom": ["Barclays", "HSBC UK", "Lloyds Bank", "NatWest", "Santander UK", "Monzo", "Revolut", "Starling Bank", "Wise"],
  "Germany": ["Deutsche Bank", "Commerzbank", "N26", "Sparkasse", "DKB", "ING Germany", "Wise", "Revolut"],
  "India": ["State Bank of India", "HDFC Bank", "ICICI Bank", "Axis Bank", "Kotak Mahindra", "Paytm", "PhonePe", "Wise"],
  "United Arab Emirates": ["Emirates NBD", "First Abu Dhabi Bank", "Abu Dhabi Commercial Bank", "Mashreq", "ADIB", "Wio Bank"],
  "Turkey": ["Ziraat Bankası", "İş Bankası", "Garanti BBVA", "Akbank", "Yapı Kredi", "Papara", "Wise"],
  "Canada": ["RBC", "TD Canada Trust", "Scotiabank", "BMO", "CIBC", "Tangerine", "Wise"],
  "Australia": ["Commonwealth Bank", "Westpac", "ANZ", "NAB", "ING Australia", "Wise"],
  "Europe": ["Wise", "Revolut", "N26", "Bunq", "PayPal"],
  "Other": ["Wise", "Revolut", "PayPal", "Payoneer", "Cash"]
};

// Sorted list of country names for the country dropdown
window.NOMAD_WEALTH_COUNTRIES = Object.keys(window.NOMAD_WEALTH_BANKS);
