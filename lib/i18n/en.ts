// K-AV-I18N.0a: English dictionary · same shape as th.ts (missing key = tsc error)
import type { Dict } from "./th";

export const en: Dict = {
  nav: {
    tournaments: "Tournaments",
    teams: "Teams",
    rules: "Rules",
    passport: "Passport",
    me: "Me",
    myTeams: "My teams",
    admin: "Admin",
    login: "Log in",
    logout: "Log out",
    account: "Account",
    menu: "Menu",
    notifications: "Notifications",
    soon: "Coming soon",
    gameLocked: "This page belongs to one game",
    language: "Language",
  },
  // K-AV-I18N.0b: Home page (signed in) · literal translation of th.ts
  home: {
    banner: {
      label: "AVELAi banner",
      slideOf: "{n} of {total}",
      goTo: "Go to slide {n}: {title}",
      soloBody: "Teams shuffled every round, perfectly weighted by score",
      soloCta: "Join",
      // keep "28 days" meaning until PASS.2
      passBody: "Arena Pass 380 THB / 28 days (4 weeks) → 75% goes to the prize pool (285 THB/player) · split Daily 40% · Weekend 35% · Season/Monthly 25%",
      passCta: "Buy Pass",
      avelAlt: "AVEL",
    },
    games: {
      title: "Choose a game",
      soon: "Coming soon",
    },
    forYou: {
      title: "Tournaments for you",
      empty: "No tournaments open yet",
      seeAll: "See all tournaments",
      more: "See more",
      slots: "{n} slots",
    },
    rails: {
      gamesAndLeagues: "Games and leagues",
      mlbbSoon: "MLBB (coming soon)",
      pickGame: "Choose a game",
      mine: "Mine",
      activities: "My activities",
      noActivities: "No activities yet",
      findTournament: "Find a tournament",
      party: "Party",
      partyClosed: "Parties are not open yet",
      createParty: "Create party",
      myTeams: "My teams",
      noTeams: "No team yet",
      createTeam: "Create team",
      friends: "Friends",
      friendsClosed: "Friends are not open yet",
      addFriend: "Add friend",
    },
    time: {
      now: "Now",
      tbd: "Date TBA",
      inMinutes: "In {n} min",
      today: "Today {time}",
      tomorrow: "Tomorrow {time}",
    },
  },
};
