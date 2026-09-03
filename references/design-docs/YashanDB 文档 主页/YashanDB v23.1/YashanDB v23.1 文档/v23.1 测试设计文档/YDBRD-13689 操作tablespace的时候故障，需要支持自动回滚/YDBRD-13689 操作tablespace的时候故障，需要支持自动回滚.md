Created by 刘美秀, last modified on 十月 31, 2023

# 1.   **概述**

本文描述操作tablespace的时候故障，自动回滚功能测试设计

  [YDBRD-13689](https://jira.yasdb.com/browse/YDBRD-13689?src=confmacro)    **-**  **操作tablespace的时候故障，需要支持自动回滚**  **完成**

设计文档  **：**    [tablespace故障，支持自动回滚设计文档 - 吴煜 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=109599807&focusedCommentId=109603428&version=2.5.50000.157&platform=win#11%E7%A1%AE%E8%AE%A4%E7%B3%BB%E7%BB%9F%E6%AD%A3%E5%B8%B8%E5%9C%A8cn%E6%89%A7%E8%A1%8C%E5%91%BD%E4%BB%A4%E6%9F%A5%E8%AF%A2-dvtablespace-dvdatafiledvdatabucket-%E5%8A%A8%E6%80%81%E8%A7%86%E5%9B%BE%E8%8E%B7%E5%8F%96%E8%8A%82%E7%82%B9tablespace%E5%92%8Cdatafilebucketfile%E6%96%87%E4%BB%B6%E7%8A%B6%E6%80%81%E5%90%8E%E7%BB%AD%E6%81%A2%E5%A4%8D%E6%93%8D%E4%BD%9C%E6%A0%B9%E6%8D%AE%E6%9F%A5%E8%AF%A2%E7%BB%93%E6%9E%9C%E5%8C%B9%E9%85%8D%E5%AF%B9%E5%BA%94%E6%81%A2%E5%A4%8D%E6%93%8D%E4%BD%9C)  

# 2.   **需求分析**

cn、dn、mn在操作tablespace时发生故障，tablespace的相关操作可以在故障恢复后执行成功；如果不成功，提供手动清理的方法

tablespace的相关操作包括create、alter 、drop。

MN上执行成功之前出现故障需要手动清理，

MN上执行成功之前出现故障靠推送执行成功

# 3.   **测试设计方法**

1）验证mn、cn、dn故障下的，tablespace相关ddl的行为

2）ddl涉及create、alter、drop tablespace

3）验证相关视图及数据文件

  


# 4.   **详细测试设计**

1）验证操作tablespace故障后的相关视图

|  
|视图及数据文件|备注|
|---|---|---|
|1|dv$tablespace|  
|
|2|dv$datafile|  
|
|3|dv$databucket|  
|
|4|${YASDB_DATA}/节点名/dbfiles/|  
|
|5|${YASDB_DATA}/节点名/local_fs/|  
|


  


2）tablespace ddl场景

|  
|ddl|参数|备注|
|---|---|---|---|
|1|create|datafile和databucket都不指定|  
|
|2|  
|datafile和databucket都指定的场景|  
|
|3|alter|shrink、offline、  ~~encryption~~|  
|
|4|  
|add datafile、databucket|  
|
|5|drop |including contents|  
|
|6|  
|keep datafiles|  
|


  


3）cn、dn故障

|  
|场景|预期|备注|
|---|---|---|---|
|1|单cn|mn推成功前，手动清理；mn推成功之后，cn恢复后成功|  
|
|2|多cn|mn推成功前，手动清理；mn推成功之后，故障cn不恢复，从未故障cn查视图，tablespace操作已成功|  
|
|3|无主备dn|多个dn组 mn推成功前，手动清理；mn推成功之后，dn恢复后成功|  
|
|4|主备dn|多个dn组，部分dn节点故障，主备切换后 tablespace自动回滚|  
|
|5|  
|整个dn组故障|  
|


  


4）特殊情况、功能限制、手动回滚

mn故障，tablespace可能回滚可能没回滚；主要测试mn的手动清理

|  
|节点|场景|预期|备注|
|---|---|---|---|---|
|1|dn|内存或者磁盘空间不足，导致Tablespace推送任务（create alter）无法执行成功|需要手动清理|  
|
|2|无主备mn|mn故障恢复后|手动清理|  
|
|3|主备mn|mn切换后手动清理|手动清理|  
|
|4|  
|部分mn节点故障，主备切换后 tablespace自动回滚|手动清理|  
|
|5|  
|整个mn组故障，恢复后手动清理|手动清理|  
|


  


5）梳理该特性是否涉各个专项测试，并在详细设计中描述具体测试点

|专项|是否涉及|
|---|---|
|并发|是 |
|长稳|否|
|一致性|否|
|三方测试工具    
  (sqltest，sqlancer)|否|
|安全|否|
|DFR/testkill|是|
|HA|否|
|压力|否|
|性能|否|
|可维护性|否|


  


  


# 5.   **测试用例**

# 6.   **测试框架设计**

1. 如果用例不能实现自动化需要在此标注并说明原因
1. 如果需要使用新的测试框架实现用例的自动化，需要在此说明测试框架的架构逻辑及详细设计
1. 如果沿用已有测试框架，需要在此标注测试框架的路径


# 7.   **测试环境说明**

测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等

  


  


## Attachments:

[YDBRD-13689  tablespace故障，支持自动回滚文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5OTE4OTcwYzJhZjRmNTFmOTIwIiwicmVmX2lkIjoiNjczOTY5OTE1OTNmOTljOWZmMjM1MDA3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA3Mjc5LCJleHAiOjE3ODIyOTM2Nzl9.5x5tpyn_NeGstjrVxjUOca2L7XA1aT4hN1THTOAqwgE)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
