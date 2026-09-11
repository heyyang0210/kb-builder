Created by 吕雷奇, last modified on 十一月 08, 2023

## 1.   **概述**

本文删除/truncate 文件、目录后，YFS可以触发延迟资源回收的测试设计；

## 2.   **需求分析**

本需求的开发设计：    [YDBRD-21454: YFS支持drop/truncate file后的资源回收详细设计 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=130154163)  

特性sr连接：    [YDBRD-21454](https://jira.yasdb.com/browse/YDBRD-21454?src=confmacro)    -  YFS支持drop/truncate file后的资源回收  完成

本需求是之前YFS支持对文件/目录 truncate，删除之后，对磁盘空间，内存空间资源回收的能力补充。

触发条件：

1、  分配空间时，发现磁盘空间满时触发  ；

2、超过磁盘容量使用的阈值（DISK_USAGE_ALERT_QUOTE），yfs定时任务会触发回收，回收过程中，会检查磁盘容量是否达到健康阈值（DISK_USAGE_NORMAL_QUOTE），达到后或者没有可以回收的文件时停止回收；

  


功能限制：

可以通过db层面下发删除文件命令，也可以使用yfscmd执行truncate 和rm 文件目录操作

**从db角度看**  ：

1. 删除datafile： 
    1. drop tablespace xxx including contents and datafiles;
    1. alter tablespace xxx drop datafiles aaa;
1. 删除redo(未支持)
1. 删除归档（未支持）
1. 删除备份文件（未支持）


  


**从yfscmd角度看，涉及接口**  ：

truncate

rm

ls +dg0/recyclebin  (新增查看回收站功能)

# **3. 详细测试方法**

3.1测试设计方法

主要基于场景法和正交组合给出测试场景；

3.2详细测试设计

1.详细设计功能点；

涉及的功能测试模块：

|  
|测试模块|测试项|测试方法|  
|  
|
|---|---|---|---|---|---|
|1|参数测试|RECY_INTERVAL|边界值，场景法，正交组合|  
|  
|
|2|  
|RECY_TASK_INTERVAL|边界值，场景法，正交组合|  
|  
|
|3|  
|RECY_UPPER_THRESHOLD|边界值，场景法，正交组合|  
|  
|
|4|  
|RECY_UPPER_THRESHOLD|边界值，场景法，正交组合|  
|  
|
|5|视图测试|v$yfs_disk|场景法|  
|  
|
|6|  
|GV$YFS_DISK|场景法|  
|  
|
|7|  
|GV$YFS_DISKGROUP|场景法|  
|  
|
|8|  
|GV$YFS_FAILGROUP|场景法|  
|  
|
|9|  
|GV$YFS_FILE|场景法|  
|  
|
|10|资源回收功能|从db层面触发删除datafiles|场景法|  
|  
|
|11|  
|使用yfscmd来删除、truncate文件|场景法|  
|  
|


2.DFX关联场景：

|  
|测试项|是否涉及|  
|
|---|---|---|---|
|1|长稳|涉及|  
|
|2|可靠性|涉及|  
|
|3|并发|涉及|  
|
|4|HA|不涉及|  
|
|5|安全|涉及|  
|
|6|一致性|不涉及|  
|
|7|压力|涉及|  
|
|8|可维护性|涉及|  
|


# **4.**  **详细测试设计**   

1.冒烟用例；

2.用例

# **5.测试框架**

使用guider，ha_regress,一致性和testkill测试框架

# **6.测试环境**

本地测试环境，1台机器部署2实例；

# **7.工作量评估**

工作量：7人天

计划测试完成时间：

  


  


  


## Attachments:

[集群支持split分区.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiY2E4OTcwYzJhZjRmNTIwNmUyIiwicmVmX2lkIjoiNjczOTZiY2E1OTNmOTljOWZmMjM2NmZkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3MDkxLCJleHAiOjE3ODIzODM0OTF9.doN_u89lOxyQIC0A4NFOxogGvvFwN8hrtx97F97Tpso)

 (application/x-xmind)    


[image2023-11-7_9-36-30.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiY2FhMWFkOWEzMzExZGM4NTU3IiwicmVmX2lkIjoiNjczOTZiY2E1OTNmOTljOWZmMjM2NmZkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3MDkxLCJleHAiOjE3ODIzODM0OTF9.4bUKkad_S5bANzbsCtyzMFShFWoX7vhZb_hMphxqIqk)

 (image/png)    


[yfs支持此资源回收.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiY2I4OTcwYzJhZjRmNTIwNmUzIiwicmVmX2lkIjoiNjczOTZiY2E1OTNmOTljOWZmMjM2NmZkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3MDkxLCJleHAiOjE3ODIzODM0OTF9.thdNsmq8wzBiZZqc9bRbDjm8uoEBb7i28Ij7SD7_M_0)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[image2023-11-8_16-59-16.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiY2I4OTcwYzJhZjRmNTIwNmU0IiwicmVmX2lkIjoiNjczOTZiY2E1OTNmOTljOWZmMjM2NmZkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3MDkxLCJleHAiOjE3ODIzODM0OTF9.t3n34UNlImQgpJFy05XABEnR0G0BVmWN1aOtuRhAdlw)

 (image/png)    


[truncate file后的资源回收.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiY2I4OTcwYzJhZjRmNTIwNmU1IiwicmVmX2lkIjoiNjczOTZiY2E1OTNmOTljOWZmMjM2NmZkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3MDkxLCJleHAiOjE3ODIzODM0OTF9.V6CQFna_VRcpxWKGLjcNEgpNFROnTgYuZINmd8vfU1I)

 (application/x-xmind)    
