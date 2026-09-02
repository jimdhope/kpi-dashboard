"use client";

import { useState } from "react";
import Image from "next/image";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";

const IHD3_ICONS = [
  { src: "/ihd-guide/Battery_2.png", alt: "Battery", title: "Battery", desc: "Shows how much battery your IHD has when unplugged (it's designed to stay plugged in, so won't last unplugged more than a few hours). If it dies, just plug it back in and press the on/off button at the back." },
  { src: "/ihd-guide/Energy_Usage_Dial_3_1.png", alt: "Energy dial", title: "Energy dial", desc: "The curved bars show you how much energy you're using (press the 'Fuel' icon to toggle between gas, electricity and dual fuel). Set a budget to see a handy marker on the dial to help keep tabs on what you're using." },
  { src: "/ihd-guide/Fuel_3.png", alt: "Fuel", title: "Fuel", desc: "Press to see your gas, electricity or combined energy usage and cost." },
  { src: "/ihd-guide/Home_3.png", alt: "Home", title: "Home", desc: "Press this to head back to the home screen." },
  { src: "/ihd-guide/Now_3.png", alt: "Now", title: "Now", desc: "Click to see how much energy you're using right now." },
  { src: "/ihd-guide/IHD3_Time.png", alt: "Calendar", title: "Calendar", desc: "Press to see what you've used today, this week, this month or this year." },
  { src: "/ihd-guide/Lights_2.png", alt: "Lights", title: "Lights", desc: "Show whether your current usage is low (green), medium (amber) or high (red) in comparison to your typical usage." },
  { src: "/ihd-guide/OK_3.png", alt: "OK", title: "OK", desc: "Press to set budgets, change IHD settings, access meter info and more. Just use the left and right arrows to scroll through your options and press OK to select." },
];

const IHD6_ICONS = [
  { src: "/ihd-guide/SIGNAL_2.png", alt: "Signal", title: "Signal", desc: "Shows the signal strength between your IHD and smart meter - your IHD won't work if it's too far away from your smart meter. It's best to keep them within 5 metres of each other." },
  { src: "/ihd-guide/Energy_Usage_Dial_6.png", alt: "Energy dial", title: "Energy dial", desc: "The curved bars show you how much energy you're using (yellow shows electricity and blue shows gas). Set a budget to see a handy marker on the dial to help keep tabs on what you're using." },
  { src: "/ihd-guide/Menu_6.png", alt: "Menu", title: "Menu", desc: "Press to set budgets, change IHD settings, access meter info and more. Just use the left and right arrows to scroll through your options." },
  { src: "/ihd-guide/Numeric_Display_6.png", alt: "Usage", title: "Usage", desc: "Shows how much electricity (lightning bolt) and gas (flame) you've used in pounds and pence. Tap the cost (e.g. £0.98) to see your usage in kWh." },
  { src: "/ihd-guide/Home_6.png", alt: "Home", title: "Home", desc: "Press this to head back to the home screen." },
  { src: "/ihd-guide/IHD6_Energy_Usage_Time_Period.png", alt: "Spend over time", title: "Spend over time", desc: "Just press 'So far today' to see what you've used so far today, this week or this month, or what you're using right now." },
];

const GEO_ICONS = [
  { src: "/ihd-guide/SIGNAL_2.png", alt: "Signal", title: "Signal", desc: "Shows the signal strength between your IHD and smart meter - your IHD won't work if it's too far away from your smart meter. It's best to keep them within 5 metres of each other." },
  { src: "/ihd-guide/electricity.png", alt: "Electricity dial", title: "Electricity dial", desc: "The curved bar shows you how much energy you're using, the arrow indicating if it's low, medium or high at any given time." },
  { src: "/ihd-guide/gas.png", alt: "Flame", title: "Flame", desc: "Shows your average gas usage for the last half hour period, the larger the blue flame, the higher the usage level." },
  { src: "/ihd-guide/Home_button.png", alt: "Home", title: "Home", desc: "Press this to head back to the home screen." },
  { src: "/ihd-guide/Back_arrow_3.png", alt: "Back", title: "Back", desc: "Returns you to the previous screen." },
  { src: "/ihd-guide/OK_button_2.png", alt: "Circle", title: "Circle", desc: "Press to switch from cost in pounds and pence to power in kWh." },
  { src: "/ihd-guide/Energy_Now_3.png", alt: "Use over time", title: "Use over time", desc: "Press 'Now' to see how much energy you're using right now, and 'Today' to see how much you've used so far today." },
  { src: "/ihd-guide/light.png", alt: "Coloured light", title: "Coloured light", desc: "Shows whether your current usage is low (green), medium (amber) or high (red) in comparison to your typical usage." },
];

const FAQ = [
  { q: "What does my IHD do?", a: "Your IHD tells you how much your energy is costing over a period of time. By having access to your smart meter readings, the IHD is also able to show how your current usage compares to your historic usage; brand new smart meters need a bit of time to build up a picture of your usage to do this. IHDs help you monitor your energy usage, and can be used to see where you might save on energy by changing how you use energy, or by investing in efficient appliances." },
  { q: "Why won't my IHD switch on / why is the screen blank?", a: "We've written a useful blog on how to resolve your IHD issues and easy ways to check how much energy you're using." },
  { q: "Do I have to leave my IHD plugged in?", a: "No. It has an in-built rechargeable battery that enables you to walk around the house and turn your appliances off and on to see how much energy they use. IHDs aren't designed to be unplugged for long periods - most generally have a few hours charge - so remember to plug it in again when you're done." },
  { q: "How much electricity does an IHD use?", a: "A tiny amount. Our IHDs use about 4-5kWh of electricity a year. Based on current prices, that's a few pence every week." },
  { q: "Does my IHD show the prices including VAT?", a: "Yes. All the prices and unit rates shown on your IHD screen include VAT." },
  { q: "Will I lose all my data if I unplug my IHD?", a: "No. It'll automatically refresh your data once it's plugged back in." },
  { q: "Why does my IHD show I've been using energy even though I've been away from home?", a: "Your energy costs include the energy you use and your standing charge. Your standing charge is displayed on your IHD each day whether you are using energy or not. The daily standing charge is added at around midnight each day." },
  { q: "Where should I keep my IHD?", a: "For the best connection, keep your IHD within around 10 metres of your smart meter. Thick walls can weaken the signal, so keeping it in the same room as your meters is usually best, or at least within the vague line of sight of your smart meter." },
  { q: "I have both gas and electricity, why is the IHD only showing data for gas?", a: "As long as your lights are on, you're still being supplied with energy and the meter is recording your usage. If you can't see the electricity on your IHD, it may mean the meter is not connected to the IHD. Try moving your IHD closer to your electricity meter, turn the IHD off, wait a minute and turn it on again. If after 48 hours your IHD is still not displaying data for both fuel types, get in touch." },
  { q: "Do I take my IHD if I move home?", a: "No, as it's linked to the meters in your property, and you aren't taking those with you! Please leave the IHD behind (best to switch it off and leave it somewhere visible)." },
  { q: "I've changed my tariff, why is my IHD showing the old tariff?", a: "Your energy supplier needs to send an update to the IHD to get the new tariff showing. We usually do this remotely automatically, and it can take a few days once we have to actually update on your meter. If your new tariff information still isn't showing on your IHD after 2 weeks, please get in touch." },
];

export default function IHDGuidePage() {
  return (
    <div className="container mx-auto max-w-7xl py-8 px-4 sm:px-6 lg:px-8">
        <header className="mb-8 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-primary sm:text-5xl">
            How to use your In-Home Display
          </h1>
          <p className="mt-3 text-xl text-muted-foreground sm:mt-4">
            Your IHD can tell you everything you need to know about your energy usage.
          </p>
        </header>

        <Card className="mb-8">
          <CardContent className="p-6">
            <h2 className="text-2xl font-semibold mb-4">What is an IHD?</h2>
            <ul className="space-y-2 text-muted-foreground">
              <li>Your In-Home Display (IHD) is not your smart meter, it's the little display unit that comes with your smart meter.</li>
              <li>Instead of being attached to your smart meter, the IHD is a portable touch-screen monitor you can keep on display somewhere more convenient.</li>
              <li>Too many walls between your IHD and smart meter might mean they can't connect, so generally it's best to keep them within 10 metres of each other.</li>
              <li>You don't need a smartphone or WiFi to use your IHD - it connects to your smart meter wirelessly through a secure protocol called Zigbee (a low power, low frequency radio network similar to Bluetooth).</li>
            </ul>
          </CardContent>
        </Card>

        <Tabs defaultValue="ihd3" className="w-full">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 mb-6">
            <TabsTrigger value="ihd3">IHD 3</TabsTrigger>
            <TabsTrigger value="ihd6">IHD 6</TabsTrigger>
            <TabsTrigger value="geo">GEO IHD</TabsTrigger>
            <TabsTrigger value="trio">Trio Accessible</TabsTrigger>
          </TabsList>

          <TabsContent value="ihd3">
            <Card>
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row gap-6 mb-6">
                  <div className="flex-1">
                    <h2 className="text-2xl font-semibold mb-4">Get to know your IHD 3</h2>
                    <p className="text-muted-foreground mb-4">If you have an IHD 3 it'll look like this.</p>
                  </div>
                  <div className="flex-1 flex justify-center">
                    <Image src="/ihd-guide/IHD3.png" alt="IHD 3 display" width={300} height={250} className="rounded-lg" />
                  </div>
                </div>

                <h3 className="text-xl font-semibold mb-4">What do the icons and buttons do?</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  {IHD3_ICONS.map((icon) => (
                    <Card key={icon.alt} className="p-4 flex flex-col items-center text-center">
                      <Image src={icon.src} alt={icon.alt} width={60} height={60} className="mb-2" />
                      <h4 className="font-semibold text-sm mb-1">{icon.title}</h4>
                      <p className="text-xs text-muted-foreground">{icon.desc}</p>
                    </Card>
                  ))}
                </div>

                <Card className="p-4 bg-muted">
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <Image src="/ihd-guide/Piggy_bank.png" alt="" width={24} height={24} />
                    Set Budget
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Click OK &gt; Press the right arrow once &gt; Press Adjust settings, then OK &gt; Press Set budget, then OK &gt; Press Calendar &gt; Select how long you want the budget to be (daily, weekly, monthly) &gt; Use the arrows to increase or decrease your budget &gt; Click OK once you're happy with the amount.
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">Try to set a realistic weekly or monthly budget to keep an eye on your energy use. Please note, if you go over budget, your supply won't stop - it's just a helpful tool to see how your actual usage compares with your ideal usage.</p>
                </Card>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ihd6">
            <Card>
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row gap-6 mb-6">
                  <div className="flex-1">
                    <h2 className="text-2xl font-semibold mb-4">Get to know your IHD 6</h2>
                    <p className="text-muted-foreground mb-4">If you have an IHD 6 it'll look like this.</p>
                  </div>
                  <div className="flex-1 flex justify-center">
                    <Image src="/ihd-guide/IHD6.png" alt="IHD 6 display" width={300} height={250} className="rounded-lg" />
                  </div>
                </div>

                <h3 className="text-xl font-semibold mb-4">What do the icons and buttons do?</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                  {IHD6_ICONS.map((icon) => (
                    <Card key={icon.alt} className="p-4 flex flex-col items-center text-center">
                      <Image src={icon.src} alt={icon.alt} width={60} height={60} className="mb-2" />
                      <h4 className="font-semibold text-sm mb-1">{icon.title}</h4>
                      <p className="text-xs text-muted-foreground">{icon.desc}</p>
                    </Card>
                  ))}
                </div>

                <Card className="p-4 bg-muted">
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <Image src="/ihd-guide/Piggy_bank.png" alt="" width={24} height={24} />
                    Set Budget
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Click Menu &gt; Press Budget options &gt; Choose the fuel type &gt; Press Change &gt; Use the arrows to increase or decrease your budget &gt; Press Time period to choose how long you want the budget to last &gt; Click set when you're happy with your budget.
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">Try to set a realistic weekly or monthly budget to keep an eye on your energy use. Please note, if you go over budget, your supply won't stop - it's just a helpful tool to see how your actual usage compares with your ideal usage.</p>
                </Card>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="geo">
            <Card>
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row gap-6 mb-6">
                  <div className="flex-1">
                    <h2 className="text-2xl font-semibold mb-4">Get to know your GEO IHD</h2>
                    <p className="text-muted-foreground mb-4">If you have a GEO IHD, it'll look like this.</p>
                  </div>
                  <div className="flex-1 flex justify-center">
                    <Image src="/ihd-guide/GEO_IHD.png" alt="GEO IHD display" width={300} height={250} className="rounded-lg" />
                  </div>
                </div>

                <h3 className="text-xl font-semibold mb-4">What do the icons and buttons do?</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  {GEO_ICONS.map((icon) => (
                    <Card key={icon.alt} className="p-4 flex flex-col items-center text-center">
                      <Image src={icon.src} alt={icon.alt} width={60} height={60} className="mb-2" />
                      <h4 className="font-semibold text-sm mb-1">{icon.title}</h4>
                      <p className="text-xs text-muted-foreground">{icon.desc}</p>
                    </Card>
                  ))}
                </div>

                <Card className="p-4 bg-muted">
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <Image src="/ihd-guide/Piggy_bank.png" alt="" width={24} height={24} />
                    Set Budget
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Click Home &gt; Press the right arrow &gt; Click Settings &gt; Press the Circle button to select Settings &gt; Click Budget &gt; Click the Circle button to choose the fuel type &gt; Use the arrows to increase or decrease your budget &gt; Click the Circle button when you're happy with your budget.
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">Try to set a realistic budget to keep an eye on your energy use. Please note, if you go over budget, your supply won't stop - it's just a helpful tool to see how your actual usage compares with your ideal usage.</p>
                </Card>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="trio">
            <Card>
              <CardContent className="p-6">
                <h2 className="text-2xl font-semibold mb-4">Get to know your Trio Accessible IHD</h2>
                <p className="text-muted-foreground mb-6">
                  We now have the Trio In-Home Display - an accessible "talking" IHD for blind and visually impaired customers. This IHD can speak the contents of each screen out to you. It's been tried, tested and approved by the Royal National Institute of Blind People (RNIB). It's vital that smart energy tech be as inclusive as possible, so nobody gets left behind in the green energy revolution.
                </p>

                <h3 className="text-xl font-semibold mb-4">Speech settings</h3>
                <p className="text-muted-foreground mb-4">
                  Speech can be turned on and off by long pressing the button on the top. Even if speech is turned off, pressing this button will cause your Trio to speak the current state of the speech setting. You can interrupt the speech at any time by pressing the top button (the middle LED above the centre of the screen). This button also functions as a repeat button if you would like to hear something again.
                </p>

                <h3 className="text-xl font-semibold mb-4">Button layout</h3>
                <p className="text-muted-foreground mb-4">
                  The Trio has a screen in the middle. You can navigate with three buttons to the left of the screen, three buttons to the right of the screen, and one on the top.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <Card className="p-4">
                    <h4 className="font-semibold mb-2">Left side buttons</h4>
                    <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                      <li><strong>Home button:</strong> Press to return to the Home screen.</li>
                      <li><strong>Back button:</strong> Press to return to the previous screen.</li>
                      <li><strong>Left arrow button:</strong> Press to navigate to the previous item on the screen.</li>
                    </ol>
                  </Card>
                  <Card className="p-4">
                    <h4 className="font-semibold mb-2">Right side buttons</h4>
                    <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                      <li><strong>Menu button:</strong> Press to go to the menu.</li>
                      <li><strong>OK button:</strong> Press to select an item or to change a selected item.</li>
                      <li><strong>Right arrow button:</strong> Press to navigate to next item on the screen.</li>
                    </ol>
                  </Card>
                </div>

                <Card className="p-4 bg-muted mb-6">
                  <h4 className="font-semibold mb-2">Middle LED button</h4>
                  <p className="text-sm text-muted-foreground">
                    Interrupts or repeats speech. A long press will turn the speech on or off. The three LEDs show your electricity usage (green/left for low, amber/middle for medium or red/right for high), if your Trio only shows your gas meter these LEDs will not be on.
                  </p>
                </Card>

                <h3 className="text-xl font-semibold mb-4">Home Screen Layout</h3>
                <p className="text-muted-foreground mb-4">
                  The Home screen is broken down into two tabs - from left to right - "Now", and "Today". Press the arrow buttons (bottom left and bottom right) to navigate between them. At any time, press the home button (top left) to return to the Home screen. The Now tab on your Home screen is shown by default. All information on the screen will be spoken when selected.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <Card className="p-4">
                    <h4 className="font-semibold mb-2">"Now" tab</h4>
                    <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                      <li>Signal strength banner along the top</li>
                      <li>Electricity consumption dial (left side)</li>
                      <li>Rate of consumption shown below dial</li>
                      <li>Now/Today tabs above dials</li>
                      <li>Gas consumption flame icon (right side)</li>
                    </ol>
                  </Card>
                  <Card className="p-4">
                    <h4 className="font-semibold mb-2">"Today" tab</h4>
                    <p className="text-sm text-muted-foreground">
                      Shows electricity used today (left) and gas used today (right), in either cost or kilowatt hours. If you have a budget, the percentage of budget used so far today is shown for each fuel.
                    </p>
                  </Card>
                </div>

                <h3 className="text-xl font-semibold mb-4">Navigating the Menu</h3>
                <p className="text-muted-foreground mb-4">
                  The main menu is available from any screen. To select it, press the menu button (top right). Press the arrow buttons to move through the menu items and press OK to access them.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <Card className="p-4">
                    <h4 className="font-semibold text-sm mb-1">Usage History</h4>
                    <p className="text-xs text-muted-foreground">Displays electricity and gas consumption over hours, days, weeks or months with bar graphs.</p>
                  </Card>
                  <Card className="p-4">
                    <h4 className="font-semibold text-sm mb-1">System Status</h4>
                    <p className="text-xs text-muted-foreground">Shows status of metering network, WiFi and cloud connection.</p>
                  </Card>
                  <Card className="p-4">
                    <h4 className="font-semibold text-sm mb-1">Meter balance</h4>
                    <p className="text-xs text-muted-foreground">Shows current balance of energy used for electricity and gas.</p>
                  </Card>
                  <Card className="p-4">
                    <h4 className="font-semibold text-sm mb-1">Tariffs</h4>
                    <p className="text-xs text-muted-foreground">Shows current and next electricity/gas prices and daily charges.</p>
                  </Card>
                  <Card className="p-4">
                    <h4 className="font-semibold text-sm mb-1">Meters</h4>
                    <p className="text-xs text-muted-foreground">Information on your electricity or gas meter and current readings.</p>
                  </Card>
                  <Card className="p-4">
                    <h4 className="font-semibold text-sm mb-1">Settings</h4>
                    <p className="text-xs text-muted-foreground">Personalise talking options, repeat settings, alerts, speech and more.</p>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Card className="mt-8">
          <CardContent className="p-6">
            <h2 className="text-2xl font-semibold mb-6">In-Home Display FAQs</h2>
            <div className="space-y-4">
              {FAQ.map((item, i) => (
                <Card key={i} className="p-4">
                  <h3 className="font-semibold mb-2">{item.q}</h3>
                  <p className="text-sm text-muted-foreground">{item.a}</p>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
  );
}
