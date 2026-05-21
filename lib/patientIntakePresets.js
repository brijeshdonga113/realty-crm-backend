/**
 * Specialty-specific clinical intake sections for patient registration.
 * Each section has: title, accentColor, fields[]
 * Each field: key, label, type, options?, placeholder?, hint?, min?, max?
 *
 * Types: 'text' | 'textarea' | 'select' | 'chips' | 'scale' | 'number'
 * Data is stored in patient.specialtyData[key]
 */

export const SPECIALIZATIONS = [
  { value: 'homeopathy',    label: 'Homeopathy / Homoeopathy' },
  { value: 'general',       label: 'General Physician / Internal Medicine' },
  { value: 'dermatology',   label: 'Dermatology / Skin Care' },
  { value: 'cardiology',    label: 'Cardiology' },
  { value: 'orthopedics',   label: 'Orthopedics' },
  { value: 'pediatrics',    label: 'Pediatrics' },
  { value: 'psychiatry',    label: 'Psychiatry / Mental Health' },
  { value: 'gynecology',    label: 'Gynecology / Obstetrics' },
  { value: 'ophthalmology', label: 'Ophthalmology / Eye Care' },
  { value: 'ent',           label: 'ENT (Ear, Nose, Throat)' },
  { value: 'dentistry',     label: 'Dentistry / Dental' },
  { value: 'neurology',     label: 'Neurology' },
]

const INTAKE = {
  general: [
    {
      title: 'Chief Complaint & Vitals',
      accentColor: 'blue',
      fields: [
        { key: 'chiefComplaint',   label: 'Chief Complaint',      type: 'textarea', placeholder: 'Primary reason for visit, duration, severity…' },
        { key: 'bp',               label: 'Blood Pressure',        type: 'text',     placeholder: 'e.g. 120/80 mmHg' },
        { key: 'pulse',            label: 'Pulse Rate',            type: 'text',     placeholder: 'e.g. 72 bpm' },
        { key: 'temperature',      label: 'Temperature',           type: 'text',     placeholder: 'e.g. 98.6 °F / 37 °C' },
        { key: 'spo2',             label: 'SpO₂',                  type: 'text',     placeholder: 'e.g. 98%' },
        { key: 'weight',           label: 'Weight (kg)',            type: 'number',   placeholder: 'e.g. 70' },
        { key: 'height',           label: 'Height (cm)',            type: 'number',   placeholder: 'e.g. 170' },
      ],
    },
    {
      title: 'Systems Review',
      accentColor: 'green',
      fields: [
        { key: 'respiratory',   label: 'Respiratory',     type: 'textarea', placeholder: 'Cough, breathlessness, wheeze…' },
        { key: 'cardiovascular',label: 'Cardiovascular',  type: 'textarea', placeholder: 'Chest pain, palpitations, edema…' },
        { key: 'gastrointestinal', label: 'Gastrointestinal', type: 'textarea', placeholder: 'Nausea, vomiting, bowel habits…' },
        { key: 'neurological',  label: 'Neurological',    type: 'textarea', placeholder: 'Headache, dizziness, weakness…' },
        { key: 'musculoskeletal',label: 'Musculoskeletal', type: 'textarea', placeholder: 'Joint pain, stiffness, swelling…' },
      ],
    },
    {
      title: 'Lifestyle & Habits',
      accentColor: 'purple',
      fields: [
        { key: 'smoking',   label: 'Smoking',  type: 'chips', options: ['Non-smoker', 'Ex-smoker', 'Current smoker'] },
        { key: 'alcohol',   label: 'Alcohol',  type: 'chips', options: ['None', 'Occasional', 'Moderate', 'Heavy'] },
        { key: 'exercise',  label: 'Exercise', type: 'chips', options: ['Sedentary', 'Light', 'Moderate', 'Active'] },
        { key: 'diet',      label: 'Diet',     type: 'chips', options: ['Vegetarian', 'Non-vegetarian', 'Vegan'] },
        { key: 'lifestyleNotes', label: 'Notes', type: 'textarea', placeholder: 'Occupation exposure, sleep hours, stress level…' },
      ],
    },
  ],

  dermatology: [
    {
      title: 'Skin Complaint',
      accentColor: 'blue',
      fields: [
        { key: 'skinConcern',      label: 'Primary Skin Concern',  type: 'textarea', placeholder: 'Describe the main complaint — rash, acne, pigmentation, hair loss…' },
        { key: 'affectedAreas',    label: 'Affected Area(s)',       type: 'text',     placeholder: 'e.g. Face, Scalp, Back, Hands, Legs' },
        { key: 'duration',         label: 'Duration / Onset',       type: 'text',     placeholder: 'e.g. 3 months ago after stress' },
        { key: 'skinType',         label: 'Skin Type',              type: 'chips',    options: ['Oily', 'Dry', 'Combination', 'Normal', 'Sensitive'] },
      ],
    },
    {
      title: 'Triggers & History',
      accentColor: 'orange',
      fields: [
        { key: 'triggers',           label: 'Triggers',              type: 'chips',    options: ['Sun', 'Stress', 'Food', 'Cosmetics', 'Weather', 'Sweat', 'Hormones', 'Unknown'] },
        { key: 'aggravatingFactors', label: 'Aggravating Factors',   type: 'textarea', placeholder: 'What makes it worse?' },
        { key: 'relievingFactors',   label: 'Relieving Factors',     type: 'textarea', placeholder: 'What makes it better?' },
        { key: 'previousTreatments', label: 'Previous Treatments',   type: 'textarea', placeholder: 'Creams, oral meds, phototherapy tried before…' },
      ],
    },
    {
      title: 'Skin Care & Lifestyle',
      accentColor: 'green',
      fields: [
        { key: 'currentSkincareRoutine', label: 'Current Skincare Routine', type: 'textarea', placeholder: 'Cleanser, moisturiser, sunscreen, serums used daily…' },
        { key: 'sunExposure',            label: 'Sun Exposure',              type: 'chips',    options: ['Minimal (indoors)', 'Moderate', 'High (outdoor job)', 'Uses sunscreen'] },
        { key: 'cosmeticAllergies',      label: 'Cosmetic / Product Allergies', type: 'textarea', placeholder: 'Known reactions to products, dyes, fragrances…' },
        { key: 'dietaryHabits',          label: 'Dietary Habits',            type: 'textarea', placeholder: 'Dairy, gluten, spicy food, water intake…' },
        { key: 'hormonalStatus',         label: 'Hormonal Status',           type: 'chips',    options: ['Menstruating', 'Pregnant', 'Post-menopausal', 'On OCP', 'PCOS', 'N/A'] },
        { key: 'familySkinHistory',      label: 'Family Skin History',       type: 'textarea', placeholder: 'Psoriasis, eczema, vitiligo, skin cancer in family…' },
      ],
    },
    {
      title: 'Investigation & Assessment',
      accentColor: 'purple',
      fields: [
        { key: 'investigationsOrdered', label: 'Investigations / Tests', type: 'textarea', placeholder: 'Biopsy, patch test, KOH, thyroid, blood sugar ordered…' },
        { key: 'clinicalFindings',      label: 'Clinical Findings',      type: 'textarea', placeholder: 'Distribution, morphology, size, colour of lesions…' },
        { key: 'provisionalDiagnosis',  label: 'Provisional Diagnosis',  type: 'textarea', placeholder: 'Working diagnosis, differentials…' },
        { key: 'treatmentPlan',         label: 'Treatment Plan',         type: 'textarea', placeholder: 'Topical / oral medication, procedures, lifestyle advice…' },
      ],
    },
  ],

  cardiology: [
    {
      title: 'Cardiac Complaint',
      accentColor: 'blue',
      fields: [
        { key: 'chiefComplaint', label: 'Chief Complaint', type: 'textarea', placeholder: 'Chest pain, breathlessness, palpitations, syncope, swelling…' },
        { key: 'duration',       label: 'Duration / Onset', type: 'text',    placeholder: 'e.g. Chest pain for 2 hours, started at rest' },
        { key: 'nyhaClass',      label: 'NYHA Class (Breathlessness)',        type: 'chips', options: ['Class I — No symptoms', 'Class II — Symptoms on exertion', 'Class III — Symptoms on minimal effort', 'Class IV — Symptoms at rest'] },
      ],
    },
    {
      title: 'Vitals',
      accentColor: 'teal',
      fields: [
        { key: 'bpRight',     label: 'BP (Right Arm)',  type: 'text',   placeholder: 'e.g. 130/85 mmHg' },
        { key: 'bpLeft',      label: 'BP (Left Arm)',   type: 'text',   placeholder: 'e.g. 128/82 mmHg' },
        { key: 'heartRate',   label: 'Heart Rate',      type: 'text',   placeholder: 'e.g. 78 bpm, regular' },
        { key: 'spo2',        label: 'SpO₂',            type: 'text',   placeholder: 'e.g. 97%' },
        { key: 'weight',      label: 'Weight (kg)',     type: 'number', placeholder: 'e.g. 78' },
        { key: 'height',      label: 'Height (cm)',     type: 'number', placeholder: 'e.g. 172' },
      ],
    },
    {
      title: 'Risk Factors',
      accentColor: 'orange',
      fields: [
        { key: 'riskFactors',      label: 'Risk Factors',       type: 'chips',    options: ['Hypertension', 'Diabetes', 'Smoking', 'Obesity', 'Dyslipidemia', 'Family Hx of CAD', 'Sedentary', 'Stress'] },
        { key: 'smoking',          label: 'Smoking Status',     type: 'chips',    options: ['Non-smoker', 'Ex-smoker', 'Current smoker'] },
        { key: 'alcohol',          label: 'Alcohol',            type: 'chips',    options: ['None', 'Occasional', 'Regular'] },
        { key: 'exerciseTolerance',label: 'Exercise Tolerance', type: 'textarea', placeholder: 'How many stairs / distance can patient walk without symptoms?' },
      ],
    },
    {
      title: 'Cardiac History & Investigations',
      accentColor: 'purple',
      fields: [
        { key: 'previousCardiacEvents', label: 'Previous Cardiac Events', type: 'textarea', placeholder: 'MI, angioplasty, CABG, valve surgery, pacemaker…' },
        { key: 'ecgFindings',           label: 'ECG Findings',            type: 'textarea', placeholder: 'Rhythm, rate, ST changes, LVH, BBB…' },
        { key: 'echoFindings',          label: 'Echo / ECHO Findings',    type: 'textarea', placeholder: 'EF%, wall motion, valves, pericardial effusion…' },
        { key: 'lipidProfile',          label: 'Lipid Profile',           type: 'textarea', placeholder: 'Total cholesterol, LDL, HDL, Triglycerides…' },
        { key: 'currentCardiacMeds',    label: 'Current Cardiac Medications', type: 'textarea', placeholder: 'Beta blockers, ACE inhibitors, statins, anticoagulants…' },
      ],
    },
  ],

  orthopedics: [
    {
      title: 'Musculoskeletal Complaint',
      accentColor: 'blue',
      fields: [
        { key: 'chiefComplaint',   label: 'Chief Complaint',       type: 'textarea', placeholder: 'Pain, swelling, stiffness, deformity, weakness, instability…' },
        { key: 'affectedRegion',   label: 'Affected Region',       type: 'text',     placeholder: 'e.g. Right knee, Lumbar spine, Left shoulder' },
        { key: 'duration',         label: 'Duration / Onset',      type: 'text',     placeholder: 'e.g. 3 weeks after fall' },
        { key: 'mechanismOfInjury',label: 'Mechanism of Injury',   type: 'chips',    options: ['Trauma / Fall', 'Sports Injury', 'RTA / Accident', 'Overuse', 'Spontaneous', 'Post-operative'] },
      ],
    },
    {
      title: 'Pain Assessment',
      accentColor: 'orange',
      fields: [
        { key: 'painScore',        label: 'Pain Score (0–10)',      type: 'scale' },
        { key: 'painCharacter',    label: 'Pain Character',         type: 'chips',    options: ['Sharp', 'Dull', 'Burning', 'Throbbing', 'Shooting', 'Constant', 'Intermittent'] },
        { key: 'aggravatingFactors', label: 'Aggravating Factors', type: 'chips',    options: ['Walking', 'Standing', 'Sitting', 'Night', 'Climbing', 'Weight bearing'] },
        { key: 'relievingFactors', label: 'Relieving Factors',      type: 'chips',    options: ['Rest', 'Ice', 'Heat', 'Elevation', 'Medication', 'Physiotherapy'] },
        { key: 'radiation',        label: 'Radiation of Pain',      type: 'textarea', placeholder: 'Does pain radiate? Where to? e.g. Down the leg (sciatica)' },
      ],
    },
    {
      title: 'Clinical Findings & Investigations',
      accentColor: 'green',
      fields: [
        { key: 'clinicalExam',       label: 'Clinical Examination',  type: 'textarea', placeholder: 'ROM, swelling, tenderness, deformity, neurovascular status…' },
        { key: 'xrayFindings',       label: 'X-Ray Findings',        type: 'textarea', placeholder: 'Fracture, joint space, alignment, bone density…' },
        { key: 'mriCtFindings',      label: 'MRI / CT Findings',     type: 'textarea', placeholder: 'Disc prolapse, ligament tear, soft tissue changes…' },
        { key: 'previousTreatment',  label: 'Previous Treatment',    type: 'textarea', placeholder: 'Physiotherapy, injections, bracing, prior surgeries…' },
        { key: 'treatmentPlan',      label: 'Management Plan',       type: 'textarea', placeholder: 'Conservative, surgical, physio, medications, referral…' },
      ],
    },
  ],

  pediatrics: [
    {
      title: 'Presenting Complaint',
      accentColor: 'blue',
      fields: [
        { key: 'chiefComplaint', label: 'Chief Complaint', type: 'textarea', placeholder: 'Primary reason for visit and duration…' },
        { key: 'weight',         label: 'Weight (kg)',     type: 'number',   placeholder: 'e.g. 14.5' },
        { key: 'height',         label: 'Height (cm)',     type: 'number',   placeholder: 'e.g. 95' },
        { key: 'headCircumference', label: 'Head Circumference (cm)', type: 'number', placeholder: 'e.g. 48' },
        { key: 'temperature',    label: 'Temperature',     type: 'text',     placeholder: 'e.g. 98.6 °F' },
      ],
    },
    {
      title: 'Birth & Neonatal History',
      accentColor: 'teal',
      fields: [
        { key: 'gestationalAge',  label: 'Gestational Age at Birth', type: 'chips',    options: ['Full term (≥37w)', 'Premature (<37w)', 'Post-term (>42w)'] },
        { key: 'deliveryType',    label: 'Mode of Delivery',          type: 'chips',    options: ['Normal vaginal', 'LSCS (C-section)', 'Instrumental (forceps/vacuum)'] },
        { key: 'birthWeight',     label: 'Birth Weight (kg)',          type: 'number',   placeholder: 'e.g. 3.2' },
        { key: 'neonatalProblems',label: 'Neonatal Problems',          type: 'textarea', placeholder: 'NICU stay, jaundice, respiratory distress, birth asphyxia…' },
        { key: 'feedingHistory',  label: 'Feeding History',            type: 'chips',    options: ['Exclusively breastfed', 'Formula', 'Mixed', 'Weaned — solid food'] },
      ],
    },
    {
      title: 'Developmental Milestones',
      accentColor: 'green',
      fields: [
        { key: 'motorMilestones',    label: 'Motor Milestones',         type: 'textarea', placeholder: 'Rolling, sitting, crawling, walking age…' },
        { key: 'speechMilestones',   label: 'Speech & Language',        type: 'textarea', placeholder: 'First words, sentences, current vocabulary…' },
        { key: 'socialMilestones',   label: 'Social & Cognitive',       type: 'textarea', placeholder: 'Eye contact, social smile, school performance…' },
        { key: 'developmentConcerns',label: 'Developmental Concerns',   type: 'textarea', placeholder: 'Any delay, regression, or concerns noted by parents…' },
      ],
    },
    {
      title: 'Immunisation & Diet',
      accentColor: 'orange',
      fields: [
        { key: 'vaccinationStatus', label: 'Vaccination Status', type: 'chips',    options: ['Up to date', 'Partial', 'Not vaccinated', 'As per national schedule'] },
        { key: 'vaccinationNotes',  label: 'Vaccination Notes',  type: 'textarea', placeholder: 'Missed vaccines, adverse reactions, catch-up plan…' },
        { key: 'dietaryHabits',     label: 'Current Diet',       type: 'textarea', placeholder: 'Solid food introduction, food allergies, fussy eating…' },
        { key: 'schoolGrade',       label: 'School / Grade',     type: 'text',     placeholder: 'e.g. Class 3, Age 8' },
      ],
    },
  ],

  psychiatry: [
    {
      title: 'Presenting Problem',
      accentColor: 'blue',
      fields: [
        { key: 'presentingProblem', label: 'Presenting Problem',    type: 'textarea', placeholder: 'Main symptoms, duration, how they began…' },
        { key: 'moodScore',         label: 'Mood (0 = lowest, 10 = best)', type: 'scale' },
        { key: 'energyLevel',       label: 'Energy Level',          type: 'chips',    options: ['Very low', 'Low', 'Moderate', 'Normal', 'Elevated'] },
        { key: 'anxietyLevel',      label: 'Anxiety Level',         type: 'chips',    options: ['None', 'Mild', 'Moderate', 'Severe', 'Panic attacks'] },
      ],
    },
    {
      title: 'Sleep & Appetite',
      accentColor: 'teal',
      fields: [
        { key: 'sleepHours',       label: 'Sleep (hours/night)',    type: 'number',   placeholder: 'e.g. 5' },
        { key: 'sleepQuality',     label: 'Sleep Quality',          type: 'chips',    options: ['Good', 'Disturbed', 'Insomnia', 'Hypersomnia', 'Nightmares'] },
        { key: 'appetiteChanges',  label: 'Appetite Changes',       type: 'chips',    options: ['Normal', 'Decreased', 'Increased', 'Irregular'] },
        { key: 'weightChanges',    label: 'Weight Changes',         type: 'text',     placeholder: 'e.g. Lost 5 kg in 3 months' },
        { key: 'concentration',    label: 'Concentration / Memory', type: 'chips',    options: ['Normal', 'Mildly impaired', 'Moderately impaired', 'Severely impaired'] },
      ],
    },
    {
      title: 'Risk Assessment',
      accentColor: 'orange',
      fields: [
        { key: 'suicidalIdeation', label: 'Suicidal / Self-harm Ideation', type: 'chips',    options: ['None', 'Passive ideation', 'Active ideation', 'Past attempt', 'Plan present'] },
        { key: 'homicidalIdeation',label: 'Homicidal Ideation',            type: 'chips',    options: ['None', 'Passive', 'Active'] },
        { key: 'substanceUse',     label: 'Substance Use',                 type: 'chips',    options: ['None', 'Alcohol', 'Cannabis', 'Tobacco', 'Opioids', 'Stimulants', 'Multiple'] },
        { key: 'substanceDetails', label: 'Substance Use Details',         type: 'textarea', placeholder: 'Type, frequency, quantity, duration of use…' },
      ],
    },
    {
      title: 'Social & Psychiatric History',
      accentColor: 'purple',
      fields: [
        { key: 'socialHistory',      label: 'Social History',          type: 'textarea', placeholder: 'Relationships, living situation, employment, support system…' },
        { key: 'currentStressors',   label: 'Current Stressors',       type: 'textarea', placeholder: 'Relationship, financial, occupational, bereavement…' },
        { key: 'psychiatricHistory', label: 'Past Psychiatric History', type: 'textarea', placeholder: 'Previous episodes, hospitalisations, medications tried…' },
        { key: 'familyPsychHistory', label: 'Family Psychiatric History', type: 'textarea', placeholder: 'Mental illness in first-degree relatives…' },
        { key: 'mentalStatusExam',   label: 'Mental Status Examination', type: 'textarea', placeholder: 'Appearance, behaviour, speech, thought, perception, insight…' },
      ],
    },
  ],

  gynecology: [
    {
      title: 'Presenting Complaint',
      accentColor: 'blue',
      fields: [
        { key: 'chiefComplaint',     label: 'Chief Complaint',          type: 'textarea', placeholder: 'Menstrual irregularity, pain, discharge, fertility concern, antenatal…' },
        { key: 'lmp',                label: 'LMP (Last Menstrual Period)', type: 'text',  placeholder: 'e.g. 15/03/2025' },
        { key: 'menopausalStatus',   label: 'Menopausal Status',         type: 'chips',   options: ['Pre-menopausal', 'Peri-menopausal', 'Post-menopausal', 'Surgical menopause'] },
      ],
    },
    {
      title: 'Menstrual History',
      accentColor: 'teal',
      fields: [
        { key: 'menstrualCycle',     label: 'Cycle Regularity',          type: 'chips',    options: ['Regular', 'Irregular', 'Oligomenorrhea', 'Amenorrhea', 'Post-menopausal'] },
        { key: 'cycleDuration',      label: 'Cycle Length (days)',        type: 'text',     placeholder: 'e.g. 28 days' },
        { key: 'periodDuration',     label: 'Period Duration (days)',     type: 'text',     placeholder: 'e.g. 5 days' },
        { key: 'flowAmount',         label: 'Flow Amount',               type: 'chips',    options: ['Scanty', 'Normal', 'Heavy', 'Flooding / Clots'] },
        { key: 'dysmenorrhea',       label: 'Dysmenorrhea (Period Pain)', type: 'chips',    options: ['None', 'Mild', 'Moderate', 'Severe'] },
        { key: 'intermenstrualBleed',label: 'Intermenstrual Bleeding',    type: 'chips',    options: ['None', 'Spotting', 'Breakthrough bleeding'] },
        { key: 'pcosSymptoms',       label: 'PCOS Symptoms',             type: 'chips',    options: ['None', 'Acne', 'Hair thinning', 'Hirsutism', 'Weight gain', 'Infertility'] },
      ],
    },
    {
      title: 'Obstetric History (G P A L)',
      accentColor: 'green',
      fields: [
        { key: 'gravida',        label: 'Gravida (G)',                  type: 'number', placeholder: '0' },
        { key: 'para',           label: 'Para (P)',                     type: 'number', placeholder: '0' },
        { key: 'abortions',      label: 'Abortions (A)',                type: 'number', placeholder: '0' },
        { key: 'livingChildren', label: 'Living Children (L)',          type: 'number', placeholder: '0' },
        { key: 'pregnancyDetails', label: 'Pregnancy / Delivery Details', type: 'textarea', placeholder: 'Mode of deliveries, complications, neonatal outcomes…' },
        { key: 'contraception',  label: 'Current Contraception',        type: 'chips',   options: ['None', 'OCP', 'IUCD', 'Barrier', 'Implant', 'Tubectomy', 'Partner vasectomy'] },
      ],
    },
    {
      title: 'Gynaecological Investigations',
      accentColor: 'purple',
      fields: [
        { key: 'lastPapSmear',     label: 'Last Pap Smear',            type: 'text',     placeholder: 'Date and result' },
        { key: 'mammoUsg',         label: 'Mammography / USG Pelvis',  type: 'textarea', placeholder: 'Date and findings…' },
        { key: 'hormonalMeds',     label: 'Hormonal Medications',      type: 'textarea', placeholder: 'OCP, HRT, progesterone, thyroid meds…' },
        { key: 'clinicalFindings', label: 'Clinical Examination Findings', type: 'textarea', placeholder: 'Per speculum, per vaginum, abdominal findings…' },
      ],
    },
  ],

  ophthalmology: [
    {
      title: 'Eye Complaint',
      accentColor: 'blue',
      fields: [
        { key: 'chiefComplaint', label: 'Chief Complaint', type: 'textarea', placeholder: 'Blurred vision, pain, redness, discharge, floaters, flashes, halos…' },
        { key: 'duration',       label: 'Duration / Onset', type: 'text',   placeholder: 'e.g. Sudden onset 2 days ago' },
        { key: 'wearingGlasses', label: 'Glasses / Contacts', type: 'chips', options: ['None', 'Glasses (distance)', 'Glasses (near)', 'Bifocals', 'Contact lenses'] },
        { key: 'lastRefraction', label: 'Last Refraction / Eye Test', type: 'text', placeholder: 'e.g. 6 months ago at …' },
      ],
    },
    {
      title: 'Visual Acuity',
      accentColor: 'teal',
      fields: [
        { key: 'vaRightDistance', label: 'VA Right Eye (Distance)', type: 'text', placeholder: 'e.g. 6/12' },
        { key: 'vaLeftDistance',  label: 'VA Left Eye (Distance)',  type: 'text', placeholder: 'e.g. 6/6' },
        { key: 'vaRightNear',     label: 'VA Right Eye (Near)',     type: 'text', placeholder: 'e.g. N8' },
        { key: 'vaLeftNear',      label: 'VA Left Eye (Near)',      type: 'text', placeholder: 'e.g. N6' },
        { key: 'iop',             label: 'IOP (Intra-ocular Pressure)', type: 'text', placeholder: 'e.g. R: 14 mmHg, L: 16 mmHg' },
      ],
    },
    {
      title: 'Ocular & Systemic History',
      accentColor: 'orange',
      fields: [
        { key: 'eyeSymptoms',        label: 'Eye Symptoms',             type: 'chips',    options: ['Pain', 'Redness', 'Discharge', 'Watering', 'Floaters', 'Flashes', 'Halos', 'Double vision', 'Photophobia'] },
        { key: 'previousEyeSurgery', label: 'Previous Eye Surgery',     type: 'textarea', placeholder: 'Cataract, LASIK, retinal, glaucoma surgery, date…' },
        { key: 'systemicConditions', label: 'Systemic Conditions',      type: 'chips',    options: ['Diabetes', 'Hypertension', 'Thyroid', 'Rheumatoid Arthritis', 'None'] },
        { key: 'clinicalFindings',   label: 'Slit Lamp / Fundus Findings', type: 'textarea', placeholder: 'Cornea, lens, vitreous, disc, macula, vessels…' },
      ],
    },
  ],

  ent: [
    {
      title: 'Presenting Complaint',
      accentColor: 'blue',
      fields: [
        { key: 'chiefComplaint', label: 'Chief Complaint', type: 'textarea', placeholder: 'Ear pain, hearing loss, nasal blockage, sore throat, hoarseness…' },
        { key: 'duration',       label: 'Duration / Onset', type: 'text',   placeholder: 'e.g. 2 weeks, worsening at night' },
      ],
    },
    {
      title: 'Ear',
      accentColor: 'teal',
      fields: [
        { key: 'earSymptoms',    label: 'Ear Symptoms',    type: 'chips',    options: ['Hearing loss', 'Tinnitus', 'Vertigo / Dizziness', 'Ear pain (otalgia)', 'Discharge (otorrhea)', 'Fullness', 'None'] },
        { key: 'earFindings',    label: 'Ear Examination', type: 'textarea', placeholder: 'Canal, TM appearance, Weber, Rinne findings…' },
        { key: 'audiometry',     label: 'Audiometry',      type: 'textarea', placeholder: 'PTA, speech discrimination results if available…' },
      ],
    },
    {
      title: 'Nose & Sinuses',
      accentColor: 'orange',
      fields: [
        { key: 'noseSymptoms',    label: 'Nose Symptoms',     type: 'chips',    options: ['Nasal blockage', 'Runny nose', 'Sneezing', 'Post-nasal drip', 'Loss of smell', 'Epistaxis', 'Nasal polyps', 'None'] },
        { key: 'sinusSymptoms',   label: 'Sinus Symptoms',    type: 'chips',    options: ['Facial pain / pressure', 'Headache', 'Congestion', 'Thick discharge', 'None'] },
        { key: 'noseFindings',    label: 'Nasal Examination', type: 'textarea', placeholder: 'DNS, turbinates, polyps, endoscopy findings…' },
        { key: 'allergicHistory', label: 'Allergic History',  type: 'textarea', placeholder: 'Known allergens, seasonal pattern, antihistamines tried…' },
      ],
    },
    {
      title: 'Throat & Larynx',
      accentColor: 'purple',
      fields: [
        { key: 'throatSymptoms', label: 'Throat Symptoms',     type: 'chips',    options: ['Sore throat', 'Difficulty swallowing', 'Hoarseness', 'Voice change', 'Neck mass', 'Drooling', 'None'] },
        { key: 'throatFindings', label: 'Throat Examination',  type: 'textarea', placeholder: 'Tonsils, pharynx, larynx, vocal cords, neck nodes…' },
        { key: 'snoring',        label: 'Snoring / Sleep Apnea', type: 'chips', options: ['None', 'Snoring', 'Witnessed apnea', 'OSA diagnosed', 'On CPAP'] },
        { key: 'previousEntSurgery', label: 'Previous ENT Surgery', type: 'textarea', placeholder: 'Tonsillectomy, adenoidectomy, septoplasty, tympanostomy…' },
      ],
    },
  ],

  dentistry: [
    {
      title: 'Dental Complaint',
      accentColor: 'blue',
      fields: [
        { key: 'chiefComplaint', label: 'Chief Complaint',    type: 'textarea', placeholder: 'Pain, sensitivity, swelling, broken tooth, cosmetic concern…' },
        { key: 'affectedTooth',  label: 'Affected Tooth / Area', type: 'text', placeholder: 'e.g. Upper left molar (tooth 26), Lower right quadrant' },
        { key: 'duration',       label: 'Duration / Onset',    type: 'text',   placeholder: 'e.g. 3 days, started after eating sweets' },
        { key: 'lastDentalVisit',label: 'Last Dental Visit',   type: 'text',   placeholder: 'e.g. 1 year ago at …' },
      ],
    },
    {
      title: 'Pain Assessment',
      accentColor: 'orange',
      fields: [
        { key: 'painScore',      label: 'Pain Score (0–10)', type: 'scale' },
        { key: 'painCharacter',  label: 'Pain Character',    type: 'chips',    options: ['Constant', 'Intermittent', 'Throbbing', 'Sharp', 'Dull', 'On biting', 'On cold', 'On hot', 'Spontaneous'] },
        { key: 'swelling',       label: 'Swelling',          type: 'chips',    options: ['None', 'Intraoral', 'Extraoral (face)', 'Diffuse', 'Localised'] },
        { key: 'sensitivity',    label: 'Tooth Sensitivity', type: 'chips',    options: ['None', 'To cold', 'To hot', 'To sweet', 'To all', 'Lingers after stimulus'] },
      ],
    },
    {
      title: 'Oral History & Habits',
      accentColor: 'teal',
      fields: [
        { key: 'previousDentalTreatment', label: 'Previous Dental Treatment', type: 'textarea', placeholder: 'Fillings, extractions, RCT, crowns, orthodontics, implants…' },
        { key: 'oralHygiene',             label: 'Oral Hygiene Habits',        type: 'chips',    options: ['Brushes once daily', 'Brushes twice daily', 'Flosses', 'Uses mouthwash', 'Irregular'] },
        { key: 'dentalHabits',            label: 'Dental Habits',              type: 'chips',    options: ['Bruxism (grinding)', 'Clenching', 'Nail biting', 'Mouth breathing', 'Thumb sucking', 'None'] },
        { key: 'smoking',                 label: 'Smoking / Tobacco',          type: 'chips',    options: ['Non-smoker', 'Smoker', 'Tobacco chewing', 'Ex-smoker'] },
        { key: 'dentalAnxiety',           label: 'Dental Anxiety',             type: 'chips',    options: ['None', 'Mild', 'Moderate', 'Severe — needle phobia'] },
      ],
    },
    {
      title: 'Clinical Findings',
      accentColor: 'green',
      fields: [
        { key: 'extraoralFindings',  label: 'Extra-oral Findings',  type: 'textarea', placeholder: 'Face, TMJ, lymph nodes, swelling…' },
        { key: 'intraoralFindings',  label: 'Intra-oral Findings',  type: 'textarea', placeholder: 'Soft tissue, hard tissue, missing teeth, caries, periodontal…' },
        { key: 'radioGraphicFindings',label: 'Radiographic Findings',type: 'textarea', placeholder: 'Periapical, bitewing, OPG findings…' },
        { key: 'treatmentPlan',      label: 'Treatment Plan',        type: 'textarea', placeholder: 'Planned procedures, order of treatment, referrals…' },
      ],
    },
  ],

  neurology: [
    {
      title: 'Neurological Complaint',
      accentColor: 'blue',
      fields: [
        { key: 'chiefComplaint', label: 'Chief Complaint',   type: 'textarea', placeholder: 'Headache, seizures, weakness, numbness, dizziness, memory loss, tremor…' },
        { key: 'duration',       label: 'Duration / Onset',  type: 'text',     placeholder: 'e.g. 6 months, sudden onset' },
        { key: 'progression',    label: 'Progression',       type: 'chips',    options: ['Stable', 'Improving', 'Gradually worsening', 'Step-wise deterioration', 'Episodic'] },
      ],
    },
    {
      title: 'Headache',
      accentColor: 'orange',
      fields: [
        { key: 'headachePresent',    label: 'Headache Present',          type: 'chips',    options: ['Yes', 'No'] },
        { key: 'headacheLocation',   label: 'Headache Location',          type: 'chips',    options: ['Unilateral', 'Bilateral', 'Frontal', 'Occipital', 'Vertex', 'Periorbital'] },
        { key: 'headacheCharacter',  label: 'Headache Character',         type: 'chips',    options: ['Throbbing', 'Pressure / band', 'Stabbing', 'Constant', 'Episodic'] },
        { key: 'headacheTriggers',   label: 'Headache Triggers',          type: 'chips',    options: ['Stress', 'Sleep deprivation', 'Hormones', 'Food', 'Bright light', 'Noise', 'None identified'] },
        { key: 'headacheAssociated', label: 'Associated Symptoms',        type: 'chips',    options: ['Nausea/Vomiting', 'Photophobia', 'Phonophobia', 'Aura', 'None'] },
      ],
    },
    {
      title: 'Seizures',
      accentColor: 'teal',
      fields: [
        { key: 'seizureHistory',     label: 'Seizure History',     type: 'chips',    options: ['None', 'One episode', 'Recurrent', 'Controlled on medication', 'Drug-resistant'] },
        { key: 'seizureType',        label: 'Seizure Type',         type: 'chips',    options: ['Focal (partial)', 'Generalised tonic-clonic', 'Absence', 'Myoclonic', 'Unknown'] },
        { key: 'seizureFrequency',   label: 'Seizure Frequency',    type: 'text',     placeholder: 'e.g. 2 per month' },
        { key: 'postIctalState',     label: 'Post-ictal State',     type: 'textarea', placeholder: 'Confusion, weakness, sleep after episode…' },
      ],
    },
    {
      title: 'Motor, Sensory & Investigations',
      accentColor: 'purple',
      fields: [
        { key: 'motorSymptoms',    label: 'Motor Symptoms',         type: 'chips',    options: ['Weakness', 'Paralysis', 'Tremor', 'Rigidity', 'Ataxia / Gait disturbance', 'None'] },
        { key: 'sensorySymptoms',  label: 'Sensory Symptoms',       type: 'chips',    options: ['Numbness', 'Tingling', 'Burning', 'Pain', 'Loss of position sense', 'None'] },
        { key: 'cognitiveSymptoms',label: 'Cognitive Symptoms',     type: 'chips',    options: ['Memory loss', 'Confusion', 'Language difficulty', 'Behavioural change', 'None'] },
        { key: 'mriFindings',      label: 'MRI Brain / Spine',      type: 'textarea', placeholder: 'Findings, date…' },
        { key: 'eegFindings',      label: 'EEG Findings',           type: 'textarea', placeholder: 'Normal/abnormal, epileptiform discharges…' },
        { key: 'ncsEmgFindings',   label: 'NCS / EMG',              type: 'textarea', placeholder: 'Nerve conduction / electromyography findings…' },
      ],
    },
  ],
}

// Default homeopathy sections are handled directly in the form (existing code).
// For all other specialties, use this function.
export function getIntakeSections(specialization) {
  return INTAKE[specialization] ?? INTAKE.general
}

export function isHomeopathy(specialization) {
  return !specialization || specialization === 'homeopathy'
}

let _fid = 0
function fid() { return `f${Date.now().toString(36)}${(++_fid).toString(36)}` }

/**
 * Returns a flat array of field definitions for a specialty.
 * Shape: { id, label, type, options: string[], section }
 */
export function getDefaultFields(specialization) {
  if (isHomeopathy(specialization)) return []
  const sections = INTAKE[specialization] ?? INTAKE.general
  return sections.flatMap(section =>
    section.fields.map(f => ({
      id:      fid(),
      label:   f.label,
      type:    f.type,
      options: f.options ?? [],
      section: section.title,
    }))
  )
}
