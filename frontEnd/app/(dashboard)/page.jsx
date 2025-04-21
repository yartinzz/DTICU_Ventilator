"use client";
import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Typography,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Card,
  CardHeader,
  CardContent,
  List,
  ListItem,
  ListItemText,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import axios from 'axios';
import { useTranslation } from 'react-i18next'; // 导入翻译钩子

const API_BASE = 'http://132.181.62.177:10188';


export default function PatientInfoPage() {
  const { t } = useTranslation();  // 使用翻译钩子

  const recordTypes = [
    { key: 'diagnosis', label: t('Diagnosis Records') },
    { key: 'imaging', label: t('Imaging Records') },
    { key: 'surgery', label: t('Surgical Records') },
    { key: 'nursing', label: t('Nursing Records') },
    { key: 'infusion', label: t('Infusion Records') },
    { key: 'medication', label: t('Medication Records') }
  ];

  const [patientList, setPatientList] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState('');

  const [patientInfo, setPatientInfo] = useState({
    name: '',
    gender: '',
    ethnicity: '',
    marital_status: '',
    birth_date: '',
    age: '',
    admission_date: '',
    admission_count: 0,
  });

  const initialRecordData = recordTypes.reduce((acc, rt) => {
    acc[rt.key] = {
      startDate: '',
      endDate: '',
      records: [],
      loading: false
    };
    return acc;
  }, {});
  const [recordData, setRecordData] = useState(initialRecordData);

  const [detailDialog, setDetailDialog] = useState({
    open: false,
    recordType: '',
    recordId: null,
    recordContent: null
  });

  useEffect(() => {
    axios.get(`${API_BASE}/patients`)
      .then(res => {
        setPatientList(res.data || []);
      })
      .catch(err => {
        console.error('Failed to fetch patient list:', err);
      });
  }, []);

  const handleSelectPatient = (patientId) => {
    setSelectedPatientId(patientId);

    axios.get(`${API_BASE}/patients/${patientId}`)
    .then(res => {
      const data = res.data;

      const calculateAge = (birthDate) => {
        if (!birthDate) return '';
        const birth = new Date(birthDate);
        const today = new Date();
        let age = today.getFullYear() - birth.getFullYear();
        const monthDiff = today.getMonth() - birth.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
          age--;
        }
        return age;
      };

      setPatientInfo({
        name: data.name || '',
        gender: data.gender || '',
        ethnicity: data.ethnicity || '',
        marital_status: data.marital_status || '',
        birth_date: data.birth_date || '',
        age: calculateAge(data.birth_date),
        admission_date: data.admission_date?.slice(0, 10) || '',
        admission_count: data.admission_count || 0,
      });
    })
    .catch(err => {
      console.error('Failed to fetch patient info:', err);
    });

    recordTypes.forEach(rt => {
      fetchRecordList(patientId, rt.key, '', '');
    });
  };

  const fetchRecordList = (patientId, recordType, startDate, endDate) => {
    setRecordData(prev => ({
      ...prev,
      [recordType]: {
        ...prev[recordType],
        loading: true
      }
    }));

    const params = {};
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;

    axios.get(`${API_BASE}/patients/${patientId}/records`, {
      params: {
        record_type: recordType,
        ...params
      }
    })
      .then(res => {
        setRecordData(prev => ({
          ...prev,
          [recordType]: {
            ...prev[recordType],
            records: res.data || [],
            loading: false
          }
        }));
      })
      .catch(err => {
        console.error(`Failed to fetch ${recordType} records:`, err);
        setRecordData(prev => ({
          ...prev,
          [recordType]: {
            ...prev[recordType],
            loading: false
          }
        }));
      });
  };

  const handleDateChange = (recordType, field, value) => {
    setRecordData(prev => {
      const newObj = {
        ...prev[recordType],
        [field]: value
      };
      return {
        ...prev,
        [recordType]: newObj
      };
    });
  };

  const handleFilterSubmit = (recordType) => {
    if (!selectedPatientId) return;
    const { startDate, endDate } = recordData[recordType];
    fetchRecordList(selectedPatientId, recordType, startDate, endDate);
  };

  const handleRecordClick = (recordType, recordId) => {
    axios.get(`${API_BASE}/patients/${selectedPatientId}/records/${recordId}`)
      .then(res => {
        setDetailDialog({
          open: true,
          recordType,
          recordId,
          recordContent: res.data
        });
      })
      .catch(err => {
        console.error('Failed to fetch record details:', err);
      });
  };

  const handleDialogClose = () => {
    setDetailDialog({
      open: false,
      recordType: '',
      recordId: null,
      recordContent: null
    });
  };

  const handleSavePatientInfo = () => {
    if (!selectedPatientId) {
      alert(t('Please select a patient first!'));  // 使用翻译
      return;
    }
    axios.put(`${API_BASE}/patients/${selectedPatientId}`, {
      ...patientInfo
    })
      .then(() => {
        console.log(t('Patient info saved successfully'));  // 使用翻译
      })
      .catch(err => {
        console.error('Failed to save patient info:', err);
      });
  };

  return (
    <Box sx={{ p: 2, gap: 1, height: "100vh", width: "80vw" }}>
      <Typography
        variant="h5"
        sx={{
          fontSize: '30px',
          fontFamily: 'Arial, sans-serif',
          mt: 2,
          mb: 2
        }}
      >
        {t('Patient Profile Management')} 
      </Typography>

      {/* Patient Info Form */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} md={3}>
          <FormControl fullWidth>
            <InputLabel id="patient-select-label">{t('Select Patient')}</InputLabel>
            <Select
              labelId="patient-select-label"
              value={selectedPatientId}
              label={t('Select Patient')}
              onChange={(e) => handleSelectPatient(e.target.value)}
            >
              {patientList.map((patient) => (
                <MenuItem key={patient.patient_id} value={patient.patient_id}>
                  {patient.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        {/* Patient Info Inputs */}
        {['gender', 'ethnicity', 'marital_status', 'birth_date', 'age', 'admission_date', 'admission_count'].map((field, idx) => (
          <Grid item xs={12} md={3} key={idx}>
            <TextField
              fullWidth
              label={t(field.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase()))}  // 替换下划线并首字母大写
              value={patientInfo[field]}
              onChange={(e) => setPatientInfo({ ...patientInfo, [field]: e.target.value })}
              type={field === 'birth_date' || field === 'admission_date' ? 'date' : 'text'}
              InputLabelProps={field === 'birth_date' || field === 'admission_date' ? { shrink: true } : {}}
            />
          </Grid>
        ))}

      </Grid>

      {/* Record Cards */}
      <Grid container spacing={2} sx={{ mt: 2 }}>
        {recordTypes.map((rt) => (
          <Grid item xs={12} md={6} key={rt.key}>
            <Card>
              <CardHeader title={t(rt.label)} /> 
              <CardContent>
                <Box sx={{ display: 'flex', gap: 2, mb: 1 }}>
                  <TextField
                    label={t('Start Date')} 
                    type="date"
                    size="small"
                    sx={{ minWidth: 110, '& .MuiInputBase-root': { height: 30 } }}
                    InputLabelProps={{ shrink: true }}
                    value={recordData[rt.key].startDate}
                    onChange={(e) => handleDateChange(rt.key, 'startDate', e.target.value)}
                  />
                  <TextField
                    label={t('End Date')} 
                    type="date"
                    size="small"
                    sx={{ minWidth: 110, '& .MuiInputBase-root': { height: 30 } }}
                    InputLabelProps={{ shrink: true }}
                    value={recordData[rt.key].endDate}
                    onChange={(e) => handleDateChange(rt.key, 'endDate', e.target.value)}
                  />
                  <Button variant="outlined" size="small" sx={{ height: 30, minWidth: 60, padding: '4px 8px' }} onClick={() => handleFilterSubmit(rt.key)}>
                    {t('Filter')}
                  </Button>
                </Box>
                {recordData[rt.key].loading ? (
                  <Typography variant="body2">{t('Loading...')}</Typography> 
                ) : (
                  <List dense sx={{ maxHeight: 200, height: 150, overflow: 'auto' }}>
                    {recordData[rt.key].records.map((record) => (
                      <ListItem button="true" key={record.record_id} onClick={() => handleRecordClick(rt.key, record.record_id)}>
                        <ListItemText
                          primary={`${record.summary_content || ''}`}
                          secondary={`${t('Time')}: ${record.created_time || ''}`}
                        />
                      </ListItem>
                    ))}
                    {recordData[rt.key].records.length === 0 && (
                      <Typography variant="body2" color="text.secondary">
                        {t('No records available')}  
                      </Typography>
                    )}
                  </List>
                )}
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Dialog open={detailDialog.open} onClose={handleDialogClose} maxWidth="sm" fullWidth>
        <DialogTitle>{t('Record Details')}</DialogTitle>
        <DialogContent>
          {detailDialog.recordContent ? (
            <Box>
              <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                {JSON.stringify(detailDialog.recordContent, null, 2)}
              </Typography>
            </Box>
          ) : (
            <Typography>{t('Loading...')}</Typography>  
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDialogClose}>{t('Close')}</Button> 
        </DialogActions>
      </Dialog>
    </Box>
  );
}
