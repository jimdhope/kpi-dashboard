export interface CopilotPhrasePrompt {
  id: string;
  title: string;
  /** Words the copilot listens for in the live transcript. */
  keyWords: string[];
  /** Phrases that have been shown to complete this prompt. */
  phrases: string[];
}

export interface CopilotActionPrompt {
  id: string;
  title: string;
  detail: string;
}

export const COPILOT_PHRASE_PROMPTS: CopilotPhrasePrompt[] = [
  {
    id: "advise-recorded",
    title: "Advise Call is Recorded (OUTBOUND)",
    keyWords: ["outbound", "calls", "recorded", "training", "monitoring"],
    phrases: [
      "It is an outbound call; all calls are recorded for training and monitoring purposes.",
      "As it is an outbound call, all calls are recorded for training and monitoring purposes.",
      "Please be aware that all calls may be recorded for training and monitoring purposes.",
      "Just to let you know the calls are recorded for training and monitoring purposes.",
      "Please do note that all calls are recorded for training and monitoring purposes.",
      "Please note all calls are recorded for monitoring and training purposes.",
      "All calls are being recorded for security and quality purposes.",
      "All calls are recorded for training and quality purposes, and your personal information is very important to us.",
    ],
  },
  {
    id: "confirm-account-holder",
    title: "Confirm Account Holder",
    keyWords: ["responsible", "confirm", "account", "holder", "security"],
    phrases: [
      "Can you confirm that you are responsible for paying the energy bills against this account?",
      "Could you confirm that you are responsible for paying the energy bills on the account?",
      "Thank you, can you confirm that you are responsible for paying the energy bills against this account?",
      "If I could just speak to the account holder to go through security.",
      "Can you confirm that you are the account holder?",
      "Could you confirm that you're responsible for paying the energy bills on the account?",
    ],
  },
  {
    id: "check-psr",
    title: "Check PSR",
    keyWords: ["priority", "services", "register", "vulnerable", "condition", "illness", "pensionable"],
    phrases: [
      "As you mentioned, our priority services register has got some health issues noted. I've got mental health on here, serious or chronic terminal illness, diabetes, low income. Any changes in the last 12 months?",
      "Can I just ask you while you're on the phone, I do have you registered on the priority register. I do have you down as having children between 2 and 5, is that correct?",
      "Just to confirm for your vulnerabilities it says here that you have children in the house under 16.",
      "I do have you on the priority services register and I do have that your medications are kept in the fridge, is that correct?",
      "Just to confirm with you, we do have the priority services register. On here it is listed that you are registered as pensionable age and above the age of 75+.",
      "We do have the priority services register to ensure we have assessed any vulnerabilities in the household. You are currently listed for medical refrigeration and a low income. Is there anything else on the priority service register that needs to be updated?",
      "I can see that you are listed on our priority service register for physical impairment, low income and mental health. Other than that, are there any other changes in your recent circumstances or any updates that you would like to make me aware of?",
      "I do see that you are listed on the priority services register, is any changes that you would like to add or is everything still the same?",
    ],
  },
  {
    id: "promote-smart",
    title: "Promote SMART",
    keyWords: ["SMART", "meter", "book", "appointment", "eligible", "booking", "fitted"],
    phrases: [
      "Just to let you know you are eligible to have a SMART meter fitted and installed in your property. Do you want me to book you an appointment now?",
      "We don't currently have SMART meters in your property. This means we would require you to give us the readings monthly to maintain accurate billing. Let's look at getting your meter fitted to a SMART today.",
      "It looks like you do need a meter upgrade to a SMART meter, this is what we do recommend.",
      "While I'm on the system here, can I book you in to have a SMART meter now?",
      "Are you interested in having a SMART meter?",
      "What about upgrading to a SMART meter, would you like for us to get an engineer to come out to do that for you?",
      "I do see that you are SMART ready. I can book you an appointment to get a SMART meter in your property if you like?",
      "I have noticed that we will be in your area on the 13th November, are you ok for me to book you a SMART appointment slot now?",
    ],
  },
  {
    id: "promote-energy-services",
    title: "Promote Energy Services",
    keyWords: ["boiler", "appliances", "domestic", "general", "kitchen", "cooker", "fridge"],
    phrases: [
      "We've partnered with Domestic & General and we can offer cover for kitchen appliances under 8 years old and your boiler under 15 years old for repairs and servicing. Would you be interested in covering any of them today?",
      "We have partnered recently with Domestic & General, and we also offer our customers with boiler cover and appliances cover would be interested in any of them at all?",
      "If you need cover for your appliances, this is something we can arrange today.",
      "Just to make you aware we can cover things like kitchen appliances if you are ever interested.",
      "Are you interested in any kitchen appliances cover?",
      "Would you be interested in boiler care today?",
      "Would you be interested in boiler care or appliance care today? We have a number of products which may be tailored for you.",
      "We have now partnered with Domestic & General which means we have products for boiler and appliance care. Do you wish to learn more?",
    ],
  },
  {
    id: "update-direct-debit",
    title: "Update Direct Debit Monthly Amount",
    keyWords: ["direct", "debit", "amended", "increase", "decrease", "payment", "amount", "update"],
    phrases: [
      "We would then increase your direct debit correctly to match usage.",
      "I can see you have been informed that your direct debit needs to be increased.",
      "What we have done today is we have decreased your direct debit amount.",
      "What we will do is have a look at the account now. I can see that your balance is £523.88 in debit, since it was last billed on the 28th October. The direct debit amount is currently £65.",
      "it is recommending that we amend your payment amount after your latest reads.",
      "Once your plan has been changed, we'll set up a new direct debit for you.",
      "Your direct debit should be set up; I have updated your details.",
      "I just want to also inform you with regards to your direct debit that it will be reviewed regularly every 3 months to make sure that your payments are on track.",
    ],
  },
  {
    id: "recognise-complaint",
    title: "Recognise Complaint",
    keyWords: ["complaint", "raise", "compensation", "escalate", "recognise", "unresolved"],
    phrases: [
      "So, are you wishing to raise a complaint with us?",
      "you want me to raise a complaint due to the fact you are seeking compensation for the journey you have experienced?",
      "I can raise a complaint in regards to the amount that you hadn't agreed on being taken from your account.",
      "Your account is showing that you have raised this issue multiple times and it remains unresolved, I recognise the dissatisfaction this is causing you so I will escalate this matter via a complaint and provide you with a reference number.",
      "I will raise your dissatisfaction on the system and log the matter as resolved, as you have been happy with the resolution I have been able to provide today.",
      "On this occasion I am happy to say we can provide you with compensation via a gesture of good will to resolve this matter for you today.",
      "I would like to recognise your complaint and advise you of the next steps you should expect in terms of it's handling.",
    ],
  },
  {
    id: "repeat-contacts",
    title: "Repeat Contacts All Resolved",
    keyWords: ["repeat", "contact", "resolved", "unresolved", "multiple", "several", "called", "times", "28 days"],
    phrases: [
      "I can see on your account that you are a repeat caller, you have called in 3 times in the last 28 days. Just to confirm when you called in previously to Scottish Power was your issue resolved?",
      "I notice that you have been in contact with us 5 times over the 15 days. Is this with regards to the issue we have managed to resolve today?",
      "I can see that you've had to contact us several times in recent days. I want to make sure this is the last time you need to go to the efforts of contacting us, is there anything else at all that I can possible help you with today?",
      "Your account shows that you had called in 7 times in 28 days. Have you needed to contact us about a different issue each time?",
      "I can see you've contacted us 3 times in the last 28 days, has everything been resolved for you now?",
      "You are a repeat caller, tell me, have the actions I have completed for you today resolved any outstanding issue you had? Does anything else remain unresolved?",
    ],
  },
  {
    id: "signpost-stepchange",
    title: "Offer Signpost StepChange and Hardship Fund",
    keyWords: ["stepchange", "hardship", "fund", "struggling", "signpost", "help", "financial", "assist"],
    phrases: [
      "If you are struggling with your finances, I can signpost you to contact stepchange debt charity who may be able to assist further.",
      "Do you need any support from stepchange or the hardship fund?",
      "I will also send you information regarding third party support such as stepchange or the hardship fund.",
      "If the arrangements we have made for your account are no longer manageable or affordable, we can look at alternative help such as stepchange who can further look into your affordability and provide you with a reference number.",
      "I am going to send you some energy efficiency advice and contact details to get in touch with stepchange.",
    ],
  },
  {
    id: "one-off-payment",
    title: "Offer one-off Payment to Reduce Balance",
    keyWords: ["cash", "card", "payment", "pay", "one-off", "token", "outstanding", "balance", "debt", "arrears"],
    phrases: [
      "If you feel that you'd like to make a cash payment instead then we can do the cash payment as well",
      "Just to confirm you are always able to make one-off payment towards any outstanding balance with your account",
      "If you can make extra payments by all means you can do that and it'll reduce the arrears.",
      "If you can make a one-off payment towards the account and this would be affordable for you, then that would be encouraged.",
      "If you wish to make extra payments on top to try and reduce the balance, then this might help you out.",
      "The balance as it stands is £1447, are you able to make a payment towards that today?",
      "Just so you know, you can make a payment towards the account as a token gesture to reduce the balance outstanding at any time.",
    ],
  },
];

export const COPILOT_ACTION_PROMPTS: CopilotActionPrompt[] = [
  {
    id: "action-book-smart",
    title: "Book SMART Meter Appointment",
    detail: "Needs a physical action on the system — no phrase completes this prompt.",
  },
  {
    id: "action-stepchange-info",
    title: "Provide StepChange and Hardship Fund Info",
    detail: "Needs a physical action on the system — no phrase completes this prompt.",
  },
  {
    id: "action-raise-complaint",
    title: "Raise Complaint",
    detail: "Needs a physical action on the system — no phrase completes this prompt.",
  },
  {
    id: "action-marketing-preferences",
    title: "Update Marketing Preferences",
    detail: "Needs a physical action on the system — no phrase completes this prompt.",
  },
];
