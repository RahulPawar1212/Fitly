import type { ExerciseSeed } from './types';

/**
 * MET values from the Ainsworth Compendium of Physical Activities (2011).
 *
 * MET = multiples of resting metabolic rate. Burn is computed as
 * `MET × 3.5 × bodyWeightKg / 200 × minutes` — see src/lib/calc/burn.ts.
 *
 * Intensity bands follow ACSM: light < 3, moderate 3–6, vigorous > 6.
 */
export const EXERCISES: ExerciseSeed[] = [
  // ---------------------------------------------------------------- walking
  { name: 'Walking, slow (3.2 km/h)', aliases: ['stroll', 'dheere chalna'], category: 'walking', met: 2.8, intensity: 'light' },
  { name: 'Walking, moderate (4.8 km/h)', aliases: ['walk', 'chalna'], category: 'walking', met: 3.5, intensity: 'moderate' },
  { name: 'Walking, brisk (5.6 km/h)', aliases: ['brisk walk', 'fast walk', 'morning walk'], category: 'walking', met: 4.3, intensity: 'moderate' },
  { name: 'Walking, very brisk (6.4 km/h)', aliases: ['power walk'], category: 'walking', met: 5.0, intensity: 'vigorous' },
  { name: 'Walking uphill / incline (5.6 km/h, 5%)', aliases: ['hill walk', 'incline walk'], category: 'walking', met: 5.3, intensity: 'moderate' },
  { name: 'Walking, with stairs / stair climbing', aliases: ['stairs', 'seedhi'], category: 'walking', met: 8.0, intensity: 'vigorous' },
  { name: 'Hiking, cross-country', aliases: ['trek', 'trekking'], category: 'walking', met: 6.0, intensity: 'moderate' },

  // ----------------------------------------------------------------- cardio
  { name: 'Jogging, general', aliases: ['jog'], category: 'cardio', met: 7.0, intensity: 'vigorous' },
  { name: 'Running (8 km/h, 7:30/km)', aliases: ['run', 'daudna'], category: 'cardio', met: 8.3, intensity: 'vigorous' },
  { name: 'Running (10 km/h, 6:00/km)', aliases: ['run fast'], category: 'cardio', met: 9.8, intensity: 'vigorous' },
  { name: 'Running (12 km/h, 5:00/km)', aliases: ['sprint pace'], category: 'cardio', met: 11.8, intensity: 'vigorous' },
  { name: 'Treadmill, walking (5.6 km/h)', aliases: ['treadmill walk'], category: 'cardio', met: 4.3, intensity: 'moderate' },
  { name: 'Treadmill, incline walk (5.6 km/h, 5%)', aliases: ['treadmill incline'], category: 'cardio', met: 5.3, intensity: 'moderate' },
  { name: 'Treadmill, running (9.7 km/h)', aliases: ['treadmill run'], category: 'cardio', met: 9.8, intensity: 'vigorous' },
  { name: 'Cycling, leisure (16-19 km/h)', aliases: ['cycling', 'bicycle', 'cycle'], category: 'cardio', met: 6.8, intensity: 'moderate' },
  { name: 'Cycling, moderate (19-22 km/h)', aliases: ['cycling moderate'], category: 'cardio', met: 8.0, intensity: 'vigorous' },
  { name: 'Cycling, vigorous (22-25 km/h)', aliases: ['cycling fast'], category: 'cardio', met: 10.0, intensity: 'vigorous' },
  { name: 'Stationary bike, moderate', aliases: ['spin bike', 'exercise bike'], category: 'cardio', met: 7.0, intensity: 'vigorous' },
  { name: 'Spinning class, vigorous', aliases: ['spinning'], category: 'cardio', met: 8.5, intensity: 'vigorous' },
  { name: 'Elliptical trainer, moderate', aliases: ['cross trainer', 'elliptical'], category: 'cardio', met: 5.0, intensity: 'moderate' },
  { name: 'Rowing machine, moderate', aliases: ['rowing', 'rower'], category: 'cardio', met: 7.0, intensity: 'vigorous' },
  { name: 'Stair climber machine', aliases: ['stairmaster'], category: 'cardio', met: 9.0, intensity: 'vigorous' },
  { name: 'Skipping rope, moderate', aliases: ['jump rope', 'rassi kudna'], category: 'cardio', met: 11.8, intensity: 'vigorous' },
  { name: 'Swimming, freestyle moderate', aliases: ['swimming', 'tairna'], category: 'cardio', met: 5.8, intensity: 'moderate' },
  { name: 'Swimming, freestyle vigorous', aliases: ['swimming fast'], category: 'cardio', met: 9.8, intensity: 'vigorous' },
  { name: 'Aerobics / Zumba, general', aliases: ['aerobics', 'zumba'], category: 'cardio', met: 6.5, intensity: 'vigorous' },
  { name: 'Dancing, Bollywood / garba', aliases: ['dance', 'garba', 'bhangra'], category: 'cardio', met: 5.5, intensity: 'moderate' },

  // --------------------------------------------------------------- strength
  { name: 'Weight training, light/moderate', aliases: ['gym light', 'weights light'], category: 'strength', met: 3.5, intensity: 'light' },
  { name: 'Weight training, vigorous (free weights)', aliases: ['gym', 'weights', 'weight lifting'], category: 'strength', met: 6.0, intensity: 'vigorous' },
  { name: 'Powerlifting / heavy compound lifts', aliases: ['powerlifting', 'deadlift', 'squat'], category: 'strength', met: 6.0, intensity: 'vigorous' },
  { name: 'Bodyweight circuit (push-ups, squats)', aliases: ['calisthenics', 'bodyweight'], category: 'strength', met: 5.0, intensity: 'moderate' },
  { name: 'HIIT / circuit training, vigorous', aliases: ['hiit', 'circuit', 'crossfit'], category: 'strength', met: 8.0, intensity: 'vigorous' },
  { name: 'Core / abs workout', aliases: ['abs', 'core', 'plank'], category: 'strength', met: 3.8, intensity: 'moderate' },
  { name: 'Resistance band workout', aliases: ['bands'], category: 'strength', met: 3.5, intensity: 'moderate' },
  { name: 'Kettlebell training', aliases: ['kettlebell'], category: 'strength', met: 8.0, intensity: 'vigorous' },
  { name: 'Boxing / punching bag', aliases: ['boxing', 'bag work'], category: 'strength', met: 7.8, intensity: 'vigorous' },

  // ------------------------------------------------------------ flexibility
  { name: 'Yoga, hatha', aliases: ['yoga'], category: 'flexibility', met: 2.5, intensity: 'light' },
  { name: 'Surya Namaskar / power yoga', aliases: ['surya namaskar', 'power yoga', 'sun salutation'], category: 'flexibility', met: 4.0, intensity: 'moderate' },
  { name: 'Stretching, general', aliases: ['stretching'], category: 'flexibility', met: 2.3, intensity: 'light' },
  { name: 'Pilates, general', aliases: ['pilates'], category: 'flexibility', met: 3.0, intensity: 'moderate' },
  { name: 'Pranayama / breathing exercises', aliases: ['pranayama', 'breathing'], category: 'flexibility', met: 1.8, intensity: 'light' },
  { name: 'Meditation, seated', aliases: ['meditation', 'dhyana'], category: 'flexibility', met: 1.3, intensity: 'light' },

  // ------------------------------------------------------------------ sport
  { name: 'Cricket (batting/bowling)', aliases: ['cricket'], category: 'sport', met: 4.8, intensity: 'moderate' },
  { name: 'Badminton, social', aliases: ['badminton'], category: 'sport', met: 5.5, intensity: 'moderate' },
  { name: 'Badminton, competitive', aliases: ['badminton match'], category: 'sport', met: 7.0, intensity: 'vigorous' },
  { name: 'Table tennis', aliases: ['table tennis', 'ping pong'], category: 'sport', met: 4.0, intensity: 'moderate' },
  { name: 'Tennis, singles', aliases: ['tennis'], category: 'sport', met: 8.0, intensity: 'vigorous' },
  { name: 'Football / soccer, casual', aliases: ['football', 'soccer'], category: 'sport', met: 7.0, intensity: 'vigorous' },
  { name: 'Basketball, general', aliases: ['basketball'], category: 'sport', met: 6.5, intensity: 'vigorous' },
  { name: 'Volleyball, casual', aliases: ['volleyball'], category: 'sport', met: 4.0, intensity: 'moderate' },
  { name: 'Kabaddi', aliases: ['kabaddi'], category: 'sport', met: 7.0, intensity: 'vigorous' },
  { name: 'Squash', aliases: ['squash'], category: 'sport', met: 7.3, intensity: 'vigorous' },
  { name: 'Golf, walking with clubs', aliases: ['golf'], category: 'sport', met: 4.8, intensity: 'moderate' },

  // ------------------------------------------------------------------ other
  { name: 'Household chores, general', aliases: ['housework', 'cleaning', 'ghar ka kaam'], category: 'other', met: 3.3, intensity: 'moderate' },
  { name: 'Cooking / kitchen work, standing', aliases: ['cooking', 'khana banana'], category: 'other', met: 2.5, intensity: 'light' },
  { name: 'Gardening, general', aliases: ['gardening', 'bagwani'], category: 'other', met: 3.8, intensity: 'moderate' },
  { name: 'Playing with children, moderate', aliases: ['playing with kids'], category: 'other', met: 3.5, intensity: 'moderate' },
  { name: 'Shopping / walking in a mall', aliases: ['shopping'], category: 'other', met: 2.3, intensity: 'light' },
  { name: 'Desk work / sitting', aliases: ['desk work', 'sitting'], category: 'other', met: 1.5, intensity: 'light' },
];
