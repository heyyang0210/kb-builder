Created by 李世铭, last modified by  施新华 on 十一月 14, 2023

# 1.     **概述**

ycs/yfs配置参数展示

# 2.     **需求分析**

  [YDBRD-13224](https://jira.yasdb.com/browse/YDBRD-13224?src=confmacro)    **-**  **【OM】支持查看配置YCS/YFS配置参数**  **完成**

**设计文档：**    [YCS，YFS配置项查看参数设计文档](109600918.html)  

### **2.1 功能分析**

- ycs配置参数展示


./yasboot ycs config show -c yashan -n 1-1    
  parameters | current_value    
  ---------------------------------------------------    
  YCR_DISK | /dev/mapper/lun03-100M    
  -------------+-------------------------------------    
  _HOST_NAME | yas1    
  -------------+-------------------------------------    
  LOG_LEVEL | DEBUG    
  -------------+-------------------------------------    
  VOTING_DISK | /dev/mapper/lun02-100M    
  -------------+-------------------------------------

- yfs配置参数展示


./yasboot yfs config show -c yashan -n 1-1    
  parameters | current_value    
  -------------------------------------------------------    
  SYS_AREA_SIZE | 256M    
  -----------------+-------------------------------------    
  RECY_INTERVAL | 86400    
  -----------------+-------------------------------------    
  YFS_PACKET_SIZE | 1M    
  -----------------+-------------------------------------    
  LOG_LEVEL | DEBUG    
  -----------------+-------------------------------------    
  BOOT_DISK | /dev/mapper/lun03-100M    
  -----------------+-------------------------------------    
  SHM_POOL_SIZE | 64M    
  -----------------+------------------------------------  -

### **2.2 约束**

1. 目前共享集群不太稳定，所有配置项都是写死的，随意修改YCS/YFS配置项可能会引起错误；
1. 共享集群修改配置项后需要重启，且当前节点级别启停会引发问题；
1. 故暂时不支持YCS/YFS的配置项修改； 待共享集群稳定后，再提供配置参数修改功能；


# 3.   **测试设计方法**

主要采用场景法进行测试设计

|场景|描述|
|---|---|
|节点正常|查询配置正常|
|节点异常|查询配置正常|
|重启后|查询配置正常|


# 4.   **详细测试设计**

## Attachments:

[OM支持查看配置YCSYFS配置参数.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NzY4OTcwYzJhZjRmNTFmODMyIiwicmVmX2lkIjoiNjczOTY5NzY3MjgyMDZlZmI5MmVmM2I2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA2ODg3LCJleHAiOjE3ODIyOTMyODd9.HXBXsHBYzsueAuBi4lSA8hNGE01Yf39xQeEAp8VnrKg)

 (application/x-xmind)    
