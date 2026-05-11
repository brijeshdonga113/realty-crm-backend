const PRESETS = {
  general: {
    billingItems: [
      { description: 'General Consultation',        unitPrice: 500 },
      { description: 'Follow-up Consultation',      unitPrice: 300 },
      { description: 'Blood Test (CBC)',             unitPrice: 150 },
      { description: 'Blood Sugar Test',            unitPrice:  80 },
      { description: 'ECG',                         unitPrice: 200 },
      { description: 'Chest X-Ray',                 unitPrice: 350 },
      { description: 'Urine Analysis',              unitPrice: 100 },
      { description: 'Blood Pressure Check',        unitPrice:  50 },
    ],
    diagnoses: [
      'Upper Respiratory Infection', 'Hypertension', 'Type 2 Diabetes',
      'Anemia', 'Fever (Pyrexia)', 'UTI', 'Gastroenteritis', 'Migraine',
      'GERD', 'Anxiety Disorder', 'Vitamin D Deficiency', 'Hypothyroidism',
    ],
  },

  cardiology: {
    billingItems: [
      { description: 'Cardiology Consultation',     unitPrice:  800 },
      { description: 'Follow-up Consultation',      unitPrice:  500 },
      { description: 'ECG',                         unitPrice:  200 },
      { description: 'Echocardiogram',              unitPrice: 1500 },
      { description: 'Treadmill Stress Test',       unitPrice: 2000 },
      { description: 'Holter Monitor (24 hr)',      unitPrice: 1200 },
      { description: 'Lipid Profile',               unitPrice:  250 },
      { description: 'Coronary Angiography',        unitPrice: 15000 },
    ],
    diagnoses: [
      'Hypertension', 'Coronary Artery Disease', 'Heart Failure',
      'Atrial Fibrillation', 'Angina Pectoris', 'Myocardial Infarction',
      'Arrhythmia', 'Valvular Heart Disease', 'Pericarditis', 'Hyperlipidemia',
    ],
  },

  dermatology: {
    billingItems: [
      { description: 'Dermatology Consultation',    unitPrice:  700 },
      { description: 'Follow-up Consultation',      unitPrice:  400 },
      { description: 'Skin Biopsy',                 unitPrice: 1500 },
      { description: 'Chemical Peel',               unitPrice: 2000 },
      { description: 'Cryotherapy',                 unitPrice:  800 },
      { description: 'Laser Treatment',             unitPrice: 3000 },
      { description: 'Patch Test',                  unitPrice:  500 },
      { description: 'Acne Treatment Session',      unitPrice:  600 },
    ],
    diagnoses: [
      'Acne Vulgaris', 'Atopic Dermatitis (Eczema)', 'Psoriasis',
      'Tinea Corporis', 'Urticaria', 'Seborrheic Dermatitis',
      'Contact Dermatitis', 'Rosacea', 'Vitiligo', 'Alopecia Areata',
      'Herpes Zoster', 'Melasma',
    ],
  },

  neurology: {
    billingItems: [
      { description: 'Neurology Consultation',      unitPrice:  900 },
      { description: 'Follow-up Consultation',      unitPrice:  500 },
      { description: 'EEG',                         unitPrice: 2000 },
      { description: 'MRI Brain',                   unitPrice: 5000 },
      { description: 'Nerve Conduction Study',      unitPrice: 2500 },
      { description: 'Lumbar Puncture',             unitPrice: 3000 },
      { description: 'CT Scan (Brain)',             unitPrice: 3500 },
    ],
    diagnoses: [
      'Migraine', 'Epilepsy', 'Parkinson\'s Disease', 'Multiple Sclerosis',
      'Stroke (CVA)', 'Tension Headache', 'Peripheral Neuropathy',
      'Vertigo (BPPV)', 'Alzheimer\'s Disease', 'Essential Tremor',
    ],
  },

  orthopedics: {
    billingItems: [
      { description: 'Orthopedic Consultation',     unitPrice:  700 },
      { description: 'Follow-up Consultation',      unitPrice:  400 },
      { description: 'X-Ray',                       unitPrice:  350 },
      { description: 'MRI Scan',                    unitPrice: 4000 },
      { description: 'Plaster / Cast Application',  unitPrice:  800 },
      { description: 'Physiotherapy Session',       unitPrice:  500 },
      { description: 'Joint Injection',             unitPrice: 1500 },
      { description: 'Arthroscopy',                 unitPrice: 20000 },
    ],
    diagnoses: [
      'Fracture', 'Osteoarthritis', 'Lumbar Spondylosis', 'Rotator Cuff Tear',
      'ACL Injury', 'Carpal Tunnel Syndrome', 'Plantar Fasciitis',
      'Osteoporosis', 'Gout', 'Herniated Disc', 'Tennis Elbow',
    ],
  },

  pediatrics: {
    billingItems: [
      { description: 'Pediatric Consultation',      unitPrice:  600 },
      { description: 'Follow-up Consultation',      unitPrice:  300 },
      { description: 'Vaccination',                 unitPrice:  500 },
      { description: 'Growth Monitoring',           unitPrice:  200 },
      { description: 'Blood Test (CBC)',            unitPrice:  150 },
      { description: 'Newborn Screening',           unitPrice:  800 },
      { description: 'Developmental Assessment',    unitPrice:  700 },
    ],
    diagnoses: [
      'Upper Respiratory Infection', 'Fever', 'Otitis Media', 'Asthma',
      'Tonsillitis', 'Hand Foot Mouth Disease', 'Chickenpox', 'Pneumonia',
      'Growth Delay', 'Iron Deficiency Anemia', 'Febrile Seizure',
    ],
  },

  psychiatry: {
    billingItems: [
      { description: 'Psychiatric Consultation',    unitPrice: 1000 },
      { description: 'Follow-up (45 min)',          unitPrice:  600 },
      { description: 'Follow-up (30 min)',          unitPrice:  400 },
      { description: 'Psychotherapy Session',       unitPrice:  800 },
      { description: 'Psychological Testing',       unitPrice: 2000 },
      { description: 'Group Therapy Session',       unitPrice:  400 },
    ],
    diagnoses: [
      'Major Depressive Disorder', 'Generalized Anxiety Disorder',
      'Bipolar Disorder', 'ADHD', 'Schizophrenia', 'OCD', 'PTSD',
      'Insomnia', 'Panic Disorder', 'Borderline Personality Disorder',
    ],
  },

  gynecology: {
    billingItems: [
      { description: 'OB/GYN Consultation',         unitPrice:  700 },
      { description: 'Follow-up Consultation',      unitPrice:  400 },
      { description: 'Pap Smear',                   unitPrice:  400 },
      { description: 'Obstetric Ultrasound',        unitPrice:  800 },
      { description: 'Colposcopy',                  unitPrice: 2000 },
      { description: 'IUD Insertion',               unitPrice: 2500 },
      { description: 'Antenatal Visit',             unitPrice:  500 },
      { description: 'Prenatal Ultrasound',         unitPrice:  900 },
    ],
    diagnoses: [
      'PCOS', 'Endometriosis', 'Uterine Fibroids', 'Menorrhagia',
      'Cervical Erosion', 'Vaginal Candidiasis', 'Preeclampsia',
      'Gestational Diabetes', 'Pelvic Inflammatory Disease', 'UTI',
    ],
  },

  ophthalmology: {
    billingItems: [
      { description: 'Eye Consultation',            unitPrice:  700 },
      { description: 'Follow-up Consultation',      unitPrice:  400 },
      { description: 'Vision Test',                 unitPrice:  300 },
      { description: 'Refraction',                  unitPrice:  400 },
      { description: 'Slit Lamp Examination',       unitPrice:  500 },
      { description: 'OCT Scan',                    unitPrice: 1500 },
      { description: 'Intravitreal Injection',      unitPrice: 5000 },
      { description: 'Cataract Surgery',            unitPrice: 30000 },
    ],
    diagnoses: [
      'Myopia', 'Hyperopia', 'Astigmatism', 'Cataracts', 'Glaucoma',
      'Diabetic Retinopathy', 'Macular Degeneration', 'Conjunctivitis',
      'Dry Eye Syndrome', 'Retinal Detachment',
    ],
  },

  ent: {
    billingItems: [
      { description: 'ENT Consultation',            unitPrice:  600 },
      { description: 'Follow-up Consultation',      unitPrice:  300 },
      { description: 'Audiometry',                  unitPrice:  500 },
      { description: 'Tympanometry',                unitPrice:  400 },
      { description: 'Nasal Endoscopy',             unitPrice: 1000 },
      { description: 'Ear Wax Removal',             unitPrice:  300 },
      { description: 'Tonsillectomy',               unitPrice: 15000 },
    ],
    diagnoses: [
      'Sinusitis', 'Otitis Media', 'Tonsillitis', 'Allergic Rhinitis',
      'Pharyngitis', 'Laryngitis', 'Hearing Loss', 'Vertigo (BPPV)',
      'Nasal Polyps', 'Deviated Nasal Septum', 'Sleep Apnea',
    ],
  },

  dentistry: {
    billingItems: [
      { description: 'Dental Consultation',         unitPrice:   400 },
      { description: 'Follow-up Consultation',      unitPrice:   200 },
      { description: 'Dental X-Ray',                unitPrice:   300 },
      { description: 'Tooth Extraction',            unitPrice:   800 },
      { description: 'Root Canal Treatment',        unitPrice:  5000 },
      { description: 'Dental Filling',              unitPrice:   600 },
      { description: 'Scaling & Polishing',         unitPrice:  1000 },
      { description: 'Teeth Whitening',             unitPrice:  3000 },
      { description: 'Crown / Cap',                 unitPrice:  8000 },
    ],
    diagnoses: [
      'Dental Caries', 'Periodontal Disease', 'Tooth Abscess',
      'Impacted Wisdom Tooth', 'Malocclusion', 'Gingivitis',
      'Bruxism', 'Temporomandibular Disorder', 'Tooth Sensitivity',
    ],
  },
}

const FALLBACK = PRESETS.general

export function getBillingItems(specialization) {
  return (PRESETS[specialization] ?? FALLBACK).billingItems
}

export function getDiagnosisSuggestions(specialization) {
  return (PRESETS[specialization] ?? FALLBACK).diagnoses
}
