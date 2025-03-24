"use client"
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

// 后端基础地址
const API_BASE = 'http://132.181.62.177:10188';

// 定义6种记录类型，对应下方6个卡片
const recordTypes = [
  { key: 'diagnosis', label: '诊断记录' },
  { key: 'imaging', label: '影像记录' },
  { key: 'surgery', label: '手术记录' },
  { key: 'nursing', label: '护理记录' },
  { key: 'infusion', label: '输液记录' },
  { key: 'medication', label: '用药记录' }
];

export default function PatientInfoPage() {
  // =============== 1. 基本State ===============
  // 患者列表 & 选择的患者ID
  const [patientList, setPatientList] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState('');

  // 患者基本信息
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

  // 每个记录类型的数据都存放在一个字典中
  // key为记录类型(如 'diagnosis')，value为一个对象，包含:
  //   startDate, endDate, records(列表), loading(是否在加载)
  const initialRecordData = recordTypes.reduce((acc, rt) => {
    acc[rt.key] = {
      startDate: '', // 默认空表示不过滤
      endDate: '',   // 默认空表示不过滤
      records: [],   // 该类型记录列表
      loading: false
    };
    return acc;
  }, {});
  const [recordData, setRecordData] = useState(initialRecordData);

  // 弹窗状态，用于查看某条记录的详情
  const [detailDialog, setDetailDialog] = useState({
    open: false,
    recordType: '',
    recordId: null,
    recordContent: null
  });

  // =============== 2. 获取患者列表 ===============
  useEffect(() => {
    axios.get(`${API_BASE}/patients`)
      .then(res => {
        setPatientList(res.data || []);
      })
      .catch(err => {
        console.error('获取患者列表失败:', err);
      });
  }, []);

  // =============== 3. 选择患者后获取患者信息 ===============
  const handleSelectPatient = (patientId) => {
    setSelectedPatientId(patientId);

    axios.get(`${API_BASE}/patients/${patientId}`)
    .then(res => {
      const data = res.data;
  
      // 计算年龄
      const calculateAge = (birthDate) => {
        if (!birthDate) return ''; // 处理无生日数据情况
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
        age: calculateAge(data.birth_date), // 计算实际年龄
        admission_date: data.admission_date?.slice(0, 10) || '',
        admission_count: data.admission_count || 0,
      });
    })
    .catch(err => {
      console.error('获取患者信息失败:', err);
    });
  
    // 获取各类型的记录列表(默认全时段)
    recordTypes.forEach(rt => {
      fetchRecordList(patientId, rt.key, '', '');
    });
  };

  // =============== 4. 获取某一类型的记录列表 ===============
  const fetchRecordList = (patientId, recordType, startDate, endDate) => {
    // 更新 loading 状态
    setRecordData(prev => ({
      ...prev,
      [recordType]: {
        ...prev[recordType],
        loading: true
      }
    }));

    // 拼接查询参数
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
        // res.data 假设返回的是一个数组 [{record_id, created_time, summary...}, ...]
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
        console.error(`获取${recordType}记录失败:`, err);
        setRecordData(prev => ({
          ...prev,
          [recordType]: {
            ...prev[recordType],
            loading: false
          }
        }));
      });
    
      
  };

  // =============== 5. 时间筛选修改时，重新获取记录 ===============
  const handleDateChange = (recordType, field, value) => {
    // field 是 'startDate' or 'endDate'
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

  // 当用户点击“筛选”按钮时，根据 startDate, endDate 重新请求
  const handleFilterSubmit = (recordType) => {
    if (!selectedPatientId) return;
    const { startDate, endDate } = recordData[recordType];
    fetchRecordList(selectedPatientId, recordType, startDate, endDate);
  };

  // =============== 6. 点击某条记录 -> 打开弹窗，获取详情 ===============
  const handleRecordClick = (recordType, recordId) => {
    // 请求后端，获取该条记录的完整信息
    axios.get(`${API_BASE}/patients/${selectedPatientId}/records/${recordId}`)
      .then(res => {
        // 假设返回 { record_id, content, created_time, department, ... } 等
        setDetailDialog({
          open: true,
          recordType,
          recordId,
          recordContent: res.data
        });
      })
      .catch(err => {
        console.error('获取记录详情失败:', err);
      });
  };

  // 关闭弹窗
  const handleDialogClose = () => {
    setDetailDialog({
      open: false,
      recordType: '',
      recordId: null,
      recordContent: null
    });
  };

  // =============== 7. 保存患者基本信息 ===============
  const handleSavePatientInfo = () => {
    if (!selectedPatientId) {
      alert('请先选择患者！');
      return;
    }
    axios.put(`${API_BASE}/patients/${selectedPatientId}`, {
      ...patientInfo
    })
      .then(() => {
        console.log('患者信息保存成功');
      })
      .catch(err => {
        console.error('患者信息保存失败:', err);
      });
  };

  // =============== 8. 界面布局 ===============
  return (
    <Box sx={{ p: 2 , gap: 1,  
      height: "100vh",
      width: "80vw",}}>

    <Typography 
      variant="h5" 
      sx={{
        fontSize: '30px', // 字体大小
        fontFamily: 'Arial, sans-serif', // 字体类型
        mt: 2, // 上边距
        mb: 2 // 下边距
      }}
    >
      患者档案信息管理
    </Typography>


      {/* 患者基本信息表单 */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} md={3}>
        {/* 患者选择下拉框 */}
          <FormControl fullWidth>
            <InputLabel id="patient-select-label">选择患者</InputLabel>
            <Select
              labelId="patient-select-label"
              value={selectedPatientId}
              label="选择患者"
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
        <Grid item xs={12} md={3}>
          <TextField
            fullWidth
            label="性别"
            value={patientInfo.gender}
            onChange={(e) =>
              setPatientInfo({ ...patientInfo, gender: e.target.value })
            }
          />
        </Grid>
        <Grid item xs={12} md={3}>
          <TextField
            fullWidth
            label="民族"
            value={patientInfo.ethnicity}
            onChange={(e) =>
              setPatientInfo({ ...patientInfo, ethnicity: e.target.value })
            }
          />
        </Grid>
        <Grid item xs={12} md={3}>
          <TextField
            fullWidth
            label="婚姻"
            value={patientInfo.marital_status}
            onChange={(e) =>
              setPatientInfo({ ...patientInfo, marital_status: e.target.value })
            }
          />
        </Grid>
        <Grid item xs={12} md={3}>
          <TextField
            fullWidth
            label="出生日期"
            type="date"
            InputLabelProps={{ shrink: true }}
            value={patientInfo.birth_date}
            onChange={(e) =>
              setPatientInfo({ ...patientInfo, birth_date: e.target.value })
            }
          />
        </Grid>
        <Grid item xs={12} md={3}>
          <TextField
            fullWidth
            label="年龄"
            value={patientInfo.age}
            onChange={(e) =>
              setPatientInfo({ ...patientInfo, age: e.target.value })
            }
          />
        </Grid>
        <Grid item xs={12} md={3}>
          <TextField
            fullWidth
            label="入院日期"
            type="date"
            InputLabelProps={{ shrink: true }}
            value={patientInfo.admission_date}
            onChange={(e) =>
              setPatientInfo({ ...patientInfo, admission_date: e.target.value })
            }
          />
        </Grid>
        <Grid item xs={12} md={3}>
          <TextField
            fullWidth
            label="入院次数"
            type="number"
            value={patientInfo.admission_count}
            onChange={(e) =>
              setPatientInfo({
                ...patientInfo,
                admission_count: e.target.value
              })
            }
          />
        </Grid>
      </Grid>

      {/* ================= 下方：6个记录卡片 ================= */}
      {/* 参考你提供的示例，2行 x 3列布局 */}
      <Grid container spacing={2} sx={{ mt: 2 }}>
        {recordTypes.map((rt) => (
          <Grid item xs={12} md={6} key={rt.key} >
            <Card>
              <CardHeader title={rt.label} />
              <CardContent>
                {/* 时间筛选器 */}
                <Box sx={{ display: 'flex', gap: 2, mb: 1 }}>
                  <TextField
                    label="开始日期"
                    type="date"
                    size="small"
                    sx={{ minWidth: 110, '& .MuiInputBase-root': { height: 30 } }}
                    InputLabelProps={{ shrink: true }}
                    value={recordData[rt.key].startDate}
                    onChange={(e) =>
                      handleDateChange(rt.key, 'startDate', e.target.value)
                    }
                  />
                  <TextField
                    label="结束日期"
                    type="date"
                    size="small"
                    sx={{ minWidth: 110, '& .MuiInputBase-root': { height: 30 } }}
                    InputLabelProps={{ shrink: true }}
                    value={recordData[rt.key].endDate}
                    onChange={(e) =>
                      handleDateChange(rt.key, 'endDate', e.target.value)
                    }
                  />
                  <Button
                    variant="outlined"
                    size="small"
                    sx={{ height: 30, minWidth: 60, padding: '4px 8px' }}
                    onClick={() => handleFilterSubmit(rt.key)}
                  >
                    筛选
                  </Button>
                </Box>

                {/* 记录列表 */}
                {recordData[rt.key].loading ? (
                  <Typography variant="body2">加载中...</Typography>
                ) : (
                  <List dense sx={{ maxHeight: 200, height: 150, overflow: 'auto'}}>
                    {recordData[rt.key].records.map((record) => (
                      <ListItem
                        button="true"
                        key={record.record_id}
                        onClick={() => handleRecordClick(rt.key, record.record_id)}
                      >
                        {/* 显示简要信息，例如创建时间或summary */}
                        <ListItemText
                          primary={`${record.summary_content || ''}`}
                          secondary={`时间: ${record.created_time || ''}`}
                        />
                      </ListItem>
                    ))}
                    {recordData[rt.key].records.length === 0 && (
                      <Typography variant="body2" color="text.secondary">
                        暂无记录
                      </Typography>
                    )}
                  </List>
                )}
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* ================= 查看详情的 Dialog ================= */}
      <Dialog
        open={detailDialog.open}
        onClose={handleDialogClose}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>记录详情</DialogTitle>
        <DialogContent>
          {detailDialog.recordContent ? (
            <Box>
              <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                {JSON.stringify(detailDialog.recordContent, null, 2)}
              </Typography>
            </Box>
          ) : (
            <Typography>加载中...</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDialogClose}>关闭</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
