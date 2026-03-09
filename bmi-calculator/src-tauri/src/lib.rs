use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Serialize)]
pub struct BmiResult {
    bmi: f64,
    category: String,
    greeting: String,
    description: String,
    healthy_weight_min: f64,
    healthy_weight_max: f64,
    weight_unit: String,
    tips: Vec<String>,
    error: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct BmiHistoryEntry {
    date: String,
    #[serde(default)]
    entry_id: String,
    #[serde(default)]
    profile_id: String,
    name: String,
    #[serde(default)]
    gender: String,
    #[serde(default)]
    age: u32,
    bmi: f64,
    category: String,
    weight: f64,
    height: f64,
    unit: String,
    #[serde(default)]
    notes: String,
}

#[derive(Serialize, Deserialize)]
struct HistoryData {
    entries: Vec<BmiHistoryEntry>,
}

fn get_history_path(app_handle: &tauri::AppHandle) -> PathBuf {
    use tauri::Manager;
    let mut path = app_handle
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."));
    fs::create_dir_all(&path).ok();
    path.push("bmi_history.json");
    path
}

fn get_lifestyle_tips(category: &str, bmi: f64, gender: &str, age: u32) -> Vec<String> {
    let mut tips = match category {
        "Underweight" => vec![
            "Eat more frequent, nutrient-dense meals throughout the day.".to_string(),
            "Include protein-rich foods like eggs, lean meats, beans, and nuts.".to_string(),
            "Add healthy fats from avocados, olive oil, and nuts to your diet.".to_string(),
            "Try strength training exercises to build muscle mass.".to_string(),
            "Consider consulting a dietitian for a personalized meal plan.".to_string(),
        ],
        "Normal" => vec![
            "Maintain your balanced diet — you're doing great!".to_string(),
            "Stay active with at least 150 minutes of moderate exercise per week.".to_string(),
            "Keep hydrated — aim for 8 glasses of water daily.".to_string(),
            "Prioritize 7-9 hours of quality sleep each night.".to_string(),
            "Continue regular health check-ups to stay on track.".to_string(),
        ],
        "Overweight" => {
            let mut tips = vec![
                "Focus on portion control — use smaller plates and eat slowly.".to_string(),
                "Increase your vegetable and fiber intake to stay fuller longer.".to_string(),
                "Aim for 30 minutes of moderate exercise (walking, cycling) daily.".to_string(),
                "Reduce sugary drinks and replace them with water or herbal tea.".to_string(),
                "Track your meals to build awareness of eating habits.".to_string(),
            ];
            if bmi >= 28.0 {
                tips.push("Consider speaking with a healthcare provider about a weight management plan.".to_string());
            }
            tips
        }
        "Obese" => vec![
            "Consult a healthcare provider for a personalized weight loss plan.".to_string(),
            "Start with low-impact exercises like walking, swimming, or yoga.".to_string(),
            "Focus on whole foods — fruits, vegetables, lean proteins, and whole grains.".to_string(),
            "Reduce processed food, fast food, and high-sugar snacks.".to_string(),
            "Set small, achievable goals — even 5-10% weight loss improves health.".to_string(),
            "Consider joining a support group or working with a nutritionist.".to_string(),
        ],
        _ => vec![],
    };

    // Add age-specific tips
    if age > 0 {
        if age < 10 {
            tips.push("Encourage active play and limit screen time.".to_string());
            tips.push("Focus on a balanced diet with fruits, veggies, and whole grains.".to_string());
        } else if age <= 17 {
            tips.push("Stay active with sports or outdoor activities you enjoy.".to_string());
            tips.push("Build healthy habits now — they'll stick with you for life!".to_string());
        } else if age <= 25 {
            tips.push("Build healthy habits now — they'll stick with you for life!".to_string());
        } else if age >= 65 {
            tips.push("Focus on calcium and vitamin D for bone health.".to_string());
            tips.push("Include balance and flexibility exercises to prevent falls.".to_string());
            tips.push("Stay socially active — it benefits both mental and physical health.".to_string());
        } else if age >= 50 {
            tips.push("Focus on calcium and vitamin D for bone health.".to_string());
            tips.push("Include balance and flexibility exercises to prevent falls.".to_string());
        }
    }

    // Add gender-specific tips (age-appropriate)
    match gender {
        "female" => {
            if age >= 12 && age < 55 {
                tips.push("Ensure adequate iron intake, especially during menstruation.".to_string());
            } else if age >= 55 {
                tips.push("Post-menopause: prioritize calcium, vitamin D, and weight-bearing exercise.".to_string());
            }
            if age >= 30 {
                tips.push("Regular breast and reproductive health screenings are important.".to_string());
            }
        }
        "male" => {
            if age >= 30 {
                tips.push("Include heart-healthy foods — men have higher cardiovascular risk.".to_string());
            }
            if age >= 45 {
                tips.push("Regular prostate and cardiovascular screenings are recommended.".to_string());
            }
        }
        _ => {}
    }

    tips
}

fn calculate_healthy_range(height: f64, unit: &str) -> (f64, f64) {
    // Healthy BMI range: 18.5 - 24.9
    match unit {
        "metric" => {
            // height in cm
            let h_m = height / 100.0;
            let min_w = 18.5 * h_m * h_m;
            let max_w = 24.9 * h_m * h_m;
            ((min_w * 10.0).round() / 10.0, (max_w * 10.0).round() / 10.0)
        }
        "imperial" => {
            // height in inches
            let min_w = (18.5 * height * height) / 703.0;
            let max_w = (24.9 * height * height) / 703.0;
            ((min_w * 10.0).round() / 10.0, (max_w * 10.0).round() / 10.0)
        }
        _ => (0.0, 0.0),
    }
}

#[tauri::command]
fn calculate_bmi(name: String, gender: String, age: u32, weight: f64, height: f64, unit: String) -> BmiResult {
    if weight <= 0.0 || height <= 0.0 {
        return BmiResult {
            bmi: 0.0,
            category: String::new(),
            greeting: String::new(),
            description: String::new(),
            healthy_weight_min: 0.0,
            healthy_weight_max: 0.0,
            weight_unit: String::new(),
            tips: vec![],
            error: Some("Weight and height must be positive numbers.".to_string()),
        };
    }

    let bmi = match unit.as_str() {
        "metric" => {
            let height_m = height / 100.0;
            weight / (height_m * height_m)
        }
        "imperial" => {
            (weight / (height * height)) * 703.0
        }
        _ => {
            return BmiResult {
                bmi: 0.0,
                category: String::new(),
                greeting: String::new(),
                description: String::new(),
                healthy_weight_min: 0.0,
                healthy_weight_max: 0.0,
                weight_unit: String::new(),
                tips: vec![],
                error: Some("Invalid unit system.".to_string()),
            };
        }
    };

    let bmi = (bmi * 10.0).round() / 10.0;

    let (category, description) = match bmi {
        b if b < 18.5 => (
            "Underweight".to_string(),
            "You are below the healthy weight range.".to_string(),
        ),
        b if b < 25.0 => (
            "Normal".to_string(),
            "You are within the healthy weight range. Great job!".to_string(),
        ),
        b if b < 30.0 => (
            "Overweight".to_string(),
            "You are above the healthy weight range.".to_string(),
        ),
        _ => (
            "Obese".to_string(),
            "You are well above the healthy weight range.".to_string(),
        ),
    };

    let (healthy_weight_min, healthy_weight_max) = calculate_healthy_range(height, &unit);
    let weight_unit = if unit == "metric" { "kg" } else { "lbs" };
    let tips = get_lifestyle_tips(&category, bmi, &gender, age);

    let display_name = if name.trim().is_empty() {
        "there".to_string()
    } else {
        name.trim().to_string()
    };

    let greeting = match category.as_str() {
        "Underweight" => format!("Hey {}! Let's work on getting you to a healthier weight.", display_name),
        "Normal" => format!("Great job, {}! You're in excellent shape!", display_name),
        "Overweight" => format!("Hey {}! Small changes can make a big difference.", display_name),
        "Obese" => format!("Hey {}! Every journey starts with a single step.", display_name),
        _ => format!("Hello, {}!", display_name),
    };

    BmiResult {
        bmi,
        category,
        greeting,
        description,
        healthy_weight_min,
        healthy_weight_max,
        weight_unit: weight_unit.to_string(),
        tips,
        error: None,
    }
}

#[tauri::command]
fn save_history(app_handle: tauri::AppHandle, entry: BmiHistoryEntry) -> Result<(), String> {
    let path = get_history_path(&app_handle);
    let mut data = if path.exists() {
        let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
        serde_json::from_str::<HistoryData>(&content).unwrap_or(HistoryData { entries: vec![] })
    } else {
        HistoryData { entries: vec![] }
    };

    let mut entry = entry;
    if entry.entry_id.is_empty() {
        entry.entry_id = entry.date.clone();
    }
    data.entries.push(entry);

    // Keep only the last 50 entries
    if data.entries.len() > 50 {
        data.entries = data.entries.split_off(data.entries.len() - 50);
    }

    let json = serde_json::to_string_pretty(&data).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn load_history(app_handle: tauri::AppHandle) -> Vec<BmiHistoryEntry> {
    let path = get_history_path(&app_handle);
    if path.exists() {
        if let Ok(content) = fs::read_to_string(&path) {
            if let Ok(data) = serde_json::from_str::<HistoryData>(&content) {
                return data.entries;
            }
        }
    }
    vec![]
}

#[tauri::command]
fn clear_history(app_handle: tauri::AppHandle) -> Result<(), String> {
    let path = get_history_path(&app_handle);
    if path.exists() {
        fs::remove_file(&path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn clear_profile_history(app_handle: tauri::AppHandle, profile_id: String) -> Result<(), String> {
    let path = get_history_path(&app_handle);
    if !path.exists() {
        return Ok(());
    }

    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let mut data = serde_json::from_str::<HistoryData>(&content).unwrap_or(HistoryData { entries: vec![] });

    // Keep entries that do not belong to the profile being cleared.
    data.entries.retain(|entry| entry.profile_id != profile_id);

    let json = serde_json::to_string_pretty(&data).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn delete_history_entry(app_handle: tauri::AppHandle, entry_id: String) -> Result<(), String> {
    let path = get_history_path(&app_handle);
    if !path.exists() {
        return Ok(());
    }

    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let mut data = serde_json::from_str::<HistoryData>(&content).unwrap_or(HistoryData { entries: vec![] });
    data.entries.retain(|entry| entry.entry_id != entry_id);

    let json = serde_json::to_string_pretty(&data).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn update_history_entry(app_handle: tauri::AppHandle, updated_entry: BmiHistoryEntry) -> Result<(), String> {
    let path = get_history_path(&app_handle);
    if !path.exists() {
        return Err("History file not found.".to_string());
    }

    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let mut data = serde_json::from_str::<HistoryData>(&content).unwrap_or(HistoryData { entries: vec![] });

    if let Some(entry) = data
        .entries
        .iter_mut()
        .find(|entry| entry.entry_id == updated_entry.entry_id)
    {
        *entry = updated_entry;
    } else {
        return Err("History entry not found.".to_string());
    }

    let json = serde_json::to_string_pretty(&data).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![
            calculate_bmi,
            save_history,
            load_history,
            clear_history,
            clear_profile_history,
            delete_history_entry,
            update_history_entry
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
