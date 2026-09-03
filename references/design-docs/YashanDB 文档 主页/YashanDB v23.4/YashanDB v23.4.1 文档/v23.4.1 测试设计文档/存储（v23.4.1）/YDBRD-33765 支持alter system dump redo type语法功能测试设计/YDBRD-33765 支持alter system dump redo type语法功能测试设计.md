Created by 高亚宁, last modified on 十月 25, 2024

#   1.   **概述**

崖山的redo类型在不断地增删，每个redo类型都有对应size，如果通过redo文件去解析逻辑日志，就必须知道所有redo类型的size。

# 2.   **需求分析**

*IR链接：*    [https://pingcode.yasdb.com/ship/ideas/666fe3625d57e18ea9d29d47](https://pingcode.yasdb.com/ship/ideas/666fe3625d57e18ea9d29d47)      


*SR链接：*    [https://pingcode.yasdb.com/pjm/items/67074059e489dd0868f371bb](https://pingcode.yasdb.com/pjm/items/67074059e489dd0868f371bb)  

开发文档：

  [dump redo类型 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=171055899)  

需求来源：DSG需要读崖山的redo去解析逻辑日志，需要知道每个redo类型的size

部署形态：单机，集群，分布式

功能说明：  打印所有redo类型

|-|**接口**|**简介**|**详细**|
|---|---|---|---|
|SQL|**ALTER SYSTEM DUMP REDO TYPE;**|dump所有redo类型到trace文件|dump所有redo类型到固定名字的trace文件|


**规格：**

1. 支持nomount，mount，open下打印


##### 3.   **测试设计方法**   

1. alter system dump redo type语法测试、执行alter system dump redo type能否dump redo类型到固定名字的trace文件，使用等价类划分法
1. dump出来的redo类型是否完整、正确，使用场景法测试，覆盖所有的redo类型——责任人：志宏


  


4.   **详细测试设计**   

### 4.1 语法验证

|输入条件|有效等效类|无效等价类|备注|
|---|---|---|---|
|**ALTER SYSTEM DUMP REDO TYPE;**|正确语法，执行成功后校验trace文件中是否有redo类型相关的内容|关键字写错或者缺失,关键字顺序不对|  
|


### 4.2 功能验证（志宏）

测试观测点：

- 打印的文件名称正确
- dump的内容正确（版本号，格式，内容）


|  
|测试场景|预期|
|---|---|---|
|1|数据库  nomount，mount，open下，执行ALTER SYSTEM DUMP REDO TYPE;|成功，打印的版本号与yasdb -v一致|
|2|在备机上执行|成功，打印的版本号与yasdb -v一致|
|3|数据库执行DDL（包含增删redo/datafile）/DML业务时，打印redo类型|打印redo类型成功|
|4|权限：sys/dba用户执行，sysbackup/sysdba/普通用户执行|sys/dba用户执行成功，sysbackup/sysdba/普通用户执行报权限不足|
|5|删除diag/trace目录，执行  ALTER SYSTEM DUMP REDO TYPE;|报错YAS-00313 failed to open file /data/gaoyaning/ha_home/node_1/diag/trace/yas_redo_type.trc, errno 2, error message "No such file or directory"|
|6|执行ALTER SYSTEM DUMP REDO TYPE时，kill数据库|报错|
|7|集群覆盖以上场景|  
|
|8|分布式覆盖以上场景|  
|


# 5.  ** **  **测试用例设计**

测试场景较简单，和详细测试设计中的一致

# 6.   **测试框架设计**

1、语法验证使用regress框架

# 7.   **测试环境说明**

  


## Attachments:

[dump and trace测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZmMDJhMWFkOWEzMzExZGM5YjgwIiwicmVmX2lkIjoiNjczOTZmMDI1OTNmOTljOWZmMjM4YzA2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU4ODUxLCJleHAiOjE3ODI1NDUyNTF9.TY_fvBp_zRmk_n76-8fOxjWAw765AiJNRk7E13Crto8)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[ADR测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZmMDJhMWFkOWEzMzExZGM5YjgxIiwicmVmX2lkIjoiNjczOTZmMDI1OTNmOTljOWZmMjM4YzA2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU4ODUxLCJleHAiOjE3ODI1NDUyNTF9.DhMW6U0_yKfl71yUSqOsdJ3qTwx7GytB6WFB1Bdl1Wc)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[自动故障事件框架.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZmMDI4OTcwYzJhZjRmNTIxZDBlIiwicmVmX2lkIjoiNjczOTZmMDI1OTNmOTljOWZmMjM4YzA2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU4ODUxLCJleHAiOjE3ODI1NDUyNTF9.fsmIpYyJAk5jJ7XewOoGhsd_E8IFFrDjxbFxn8sRMuA)

 (application/vnd.xmind.workbook)    
