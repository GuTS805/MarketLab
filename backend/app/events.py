"""Curated Indian-market events, 2019-2021. Only events dated on or before the simulated day are ever served."""
from datetime import date

EVENTS = [
    (date(2019, 2, 1), "policy", "Interim Union Budget", "Income-tax rebate for incomes up to ₹5 lakh and PM-KISAN income support for small farmers."),
    (date(2019, 5, 23), "politics", "General election results", "The NDA returns to power with a strong majority and Indian indices trade at record highs."),
    (date(2019, 7, 5), "policy", "Union Budget 2019", "A higher surcharge on the super-rich triggers heavy foreign-investor selling in the weeks that follow."),
    (date(2019, 9, 20), "policy", "Corporate tax cut", "The government cuts the base corporate tax rate to 22%. The Sensex jumps about 2,000 points, its biggest one-day gain in a decade."),
    (date(2020, 1, 30), "covid", "First COVID-19 case in India", "India reports its first coronavirus case, in Kerala."),
    (date(2020, 2, 1), "policy", "Union Budget 2020", "An optional lower income-tax regime is introduced and dividend distribution tax is abolished. Markets fall about 1,000 Sensex points on the day."),
    (date(2020, 3, 5), "banking", "Yes Bank moratorium", "The RBI puts Yes Bank under a moratorium, capping withdrawals and shaking bank stocks."),
    (date(2020, 3, 9), "global", "Oil price war + virus fear", "Crude oil collapses after OPEC+ talks fail and the Sensex falls about 1,940 points in one session."),
    (date(2020, 3, 11), "covid", "WHO declares a pandemic", "COVID-19 is declared a global pandemic and sell-offs spread across world markets."),
    (date(2020, 3, 23), "covid", "Market crash day", "The Sensex and Nifty fall about 13% in a single day, hitting lower circuit limits. This is the 2020 low."),
    (date(2020, 3, 24), "covid", "21-day national lockdown", "The Prime Minister announces a nationwide lockdown starting at midnight."),
    (date(2020, 3, 27), "policy", "RBI rate cut", "The RBI cuts the repo rate by 75 bps to 4.40% and announces a loan moratorium."),
    (date(2020, 5, 12), "policy", "₹20 lakh crore stimulus", "The 'Atmanirbhar Bharat' relief package is announced."),
    (date(2020, 5, 22), "policy", "RBI cuts repo to 4%", "The RBI cuts the repo rate to a record low of 4.00%."),
    (date(2020, 11, 9), "covid", "Vaccine breakthrough", "Pfizer reports over 90% efficacy in its vaccine trial, sparking a global rally."),
    (date(2021, 1, 16), "covid", "Vaccination drive begins", "India starts what becomes one of the world's largest vaccination programmes."),
    (date(2021, 2, 1), "policy", "Union Budget 2021", "No new taxes and a big infrastructure push. The Sensex jumps about 5%, its best Budget day in over a decade."),
    (date(2021, 4, 5), "covid", "Second wave builds", "Daily COVID-19 cases cross 100,000 for the first time in India."),
    (date(2021, 9, 24), "markets", "Sensex crosses 60,000", "The Sensex closes above 60,000 for the first time."),
    (date(2021, 10, 19), "markets", "Sensex crosses 62,000", "The Sensex hits a fresh all-time high above 62,000."),
    (date(2021, 11, 26), "covid", "Omicron variant scare", "A new variant of concern is named and the Sensex falls about 1,700 points on global risk-off."),
]

def events_between(start: date | None, end: date):
    return [
        {"date": d, "kind": k, "title": t, "detail": x}
        for d, k, t, x in sorted(EVENTS, key=lambda e: e[0], reverse=True)
        if d <= end and (start is None or d >= start)
    ]
