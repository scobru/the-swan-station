# The Swan Station

A multiplayer simulation of the Swan Station (a.k.a. "the Hatch") from ABC's Lost TV series (2004-2010).

## Features

- **Authentic Experience**: Recreates the 108-minute countdown and code input system from the show
- **Multiplayer**: Take shifts with other players to maintain the station
- **Level System**: Progress through 25 levels with unique features at each level
- **Chat System**: Communicate with other players, including private messages (Level 3+)
- **Profile System**: Customize your profile and track your statistics
- **Random Events**: Experience lockdowns and other DHARMA Initiative events

## Setup

1. Install dependencies:
```bash
npm install
```

2. Required assets (some included, some need to be added):

Already included:
- `assets/tick.mp3` - Timer tick sound
- `assets/swan.png` - Swan station image
- `assets/siren.mp3` - Alarm sound
- `assets/reset.mp3` - Button reset sound
- `assets/favicon.ico` - Site favicon

Need to be added:
- `assets/digital.ttf` - Digital font for timer (recommended: "DS-Digital")
- `assets/dharma-logo.png` - DHARMA Initiative logo
- `assets/default-avatar.png` - Default user avatar

3. Start the development server:
```bash
npm start
```

## Game Rules

1. Every 108 minutes, the button must be pushed
2. When the alarm sounds, you have 4 minutes to enter the code
3. The code is: 4 8 15 16 23 42
4. Points System:
   - Registration: 5 points
   - First reset: 2 points
   - Each reset attempt: 1 point
   - 4 consecutive resets: 1 bonus point

## Level System

| Level | Points | Features Unlocked |
|-------|--------|------------------|
| 1 | 5 | Base game access |
| 2 | 30 | Profile customization |
| 3 | 80 | Private messaging |
| 4 | 130 | Custom status |
| 5 | 250 | Profile badges |
| ... | ... | ... |
| 25 | 7500 | All features |

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'feat: Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- ABC's LOST TV series for the original concept
- The DHARMA Initiative (fictional) for the inspiration
- All the fans who keep pushing the button
