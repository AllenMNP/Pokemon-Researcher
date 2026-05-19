# Pokemon Researcher

A desktop application for researching Pokemon using Bulbapedia data.

## Features

- **Bulbapedia Scraping**: Enter a Bulbapedia URL to automatically extract Pokemon information
- **Verbose & Categorized Views**: Toggle between detailed verbose data and organized categorized information
- **Local Storage**: All Pokemon data is saved locally as JSON via Express backend
- **Import/Export**: Easily import and export your Pokemon research data
- **Hamburger Menu**: Quick access to all saved Pokemon through a collapsible sidebar

## Installation

```bash
npm install
```

## Running the Application

```bash
npm run dev
```

This will start both the Express backend server and the Electron application.

## Data Storage

Pokemon data is stored in `data/pokemon.json` and can be exported/imported through the application interface.

## Information Gathered

### Required Information
- Pokemon Name, Category, Number, Type, Height, Weight, Pokedex Color

### General Information
- Pokemon Anatomy
- Pokemon Capabilities
- Pokedex Entries from all games

### Targeted Information (when available)
- Male/Female Differences
- Mating Habits
- Combat Capabilities
- Survival Capabilities
- Pokemon World Uses
- Major Events/History
- Survival/Adaptation characteristics
- Preferred Habitat
- Folklore
- Rivalries
- Unique Behaviors
- Unique Information
