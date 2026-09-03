Created by 易文亮, last modified on 十二月 14, 2023

# 1.   **概述**

本文描述LSC冷数据压缩等级适配的测试设计。

目前YashanDB支持两种压缩算法lz4/zstd，压缩水平有三种，分别为  low | medium | high，其中low的压缩率最低，效率最高。语法已支持，但压缩水平未实现，本次实现三种压缩水平。

# **2. 需求分析**

SR：    [YDBRD-21593](https://jira.yasdb.com/browse/YDBRD-21593?src=confmacro)    -  LSC冷数据压缩算法等级适配  完成

开发设计：    [【Spearfish】YDBRD-21593 : LSC冷数据压缩算法等级适配 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=133577712)  

1、系统级别参数：压缩COMPRESSION，目前默认为NONE，本次修改为LZ4，压缩水平COMPRESSION_LEVEL，默认为LOW，不变。

2、压缩水平必须紧跟压缩算法后，可指定表级别压缩或者列级别压缩

压缩等级与压缩参数关系如下

|编码类型|编码等级|实际编码等级|压缩率|压缩速度|解压速度|
|:---|:---|:---|:---|:---|:---|
|LZ4|低|lz4 default|46.14|580|2312|
|LZ4|中|LZ4HC|39.92|102|2369|
|LZ4|高|lz4HC -4|37.3|63.3|2383|
|ZSTD|低|1|27.68|312|890|
|ZSTD|中|4|26.42|179|764|
|ZSTD|高|7|25.59|55.2|806|
|LZMA|ALL|0|21.37|25.8|62.3|


### **压缩率：lz4<zstd，压缩解压性能：lz4>zstd**

# **3. 详细**  **测试设计**

## **3.1 测试设计方法**

本次主要使用等价类和场景分析法进行设计

测试点：

1、语法验证：采用等价类分析法，对压缩水平系统级别、表级别、列级别分别进行验证，优先级：列级别>表级别>系统级别

2、功能部分，验证不同压缩等级下的压缩率，确认压缩率从低到高，依次为LOW->MEDIUM→HIGH

## 3.2   **详细测试设计**

##### 4.1  压缩语法

|序号|测试场景|备注|
|---|---|---|
|1|默认配置不带压缩属性建表，确认表及列字段压缩及压缩水平属性|  
|
|2|修改系统压缩和压缩水平属性，建表确认压缩水平与配置一致|(lz4|zstd) [low|medium|high]|
|3|压缩和压缩水平带在表后能成功建表，属性正确|覆盖分区表、二级分区表|
|4|压缩和压缩水平带在表列后能成功建表，属性正确|覆盖所有数据类型|
|5|在子分区中带压缩属性报错|  
|
|6|在二级子分区中带压缩属性报错|  
|
|7|指定为不支持的压缩水平报错|  
|


##### 4.2  功能+性能

|序号|测试场景|备注|
|---|---|---|
|1|tpch100G数据，使用不同的压缩算法和压缩水平lz4|zstd [low|medium|high]，确认转换耗时和静态文件大小，转换速率依次边长，文件大小依次变小，zstd压缩率优于lz4|  
|
|2|数说大表（lsc分区表，136G数据），执行1中的操作，对比压缩率和备份/恢复速率  ，压缩率和速率与1中的结果一致|  
|
|  
|  
|  
|


# 4.  ** **  **测试用例**

冒烟用例：

[compression_level_ceil.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZWM4OTcwYzJhZjRmNTIwODAwIiwicmVmX2lkIjoiNjczOTZiZWM1OTNmOTljOWZmMjM2ODYwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3OTY3LCJleHAiOjE3ODIzODQzNjd9.UuN_i0UCAPs9G0W6MtkR4Y0jlEOefWrfKEz14eqeDs0)

文本用例：

[LSC压缩等级支持文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZWNhMWFkOWEzMzExZGM4Njc2IiwicmVmX2lkIjoiNjczOTZiZWM1OTNmOTljOWZmMjM2ODYwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3OTY3LCJleHAiOjE3ODIzODQzNjd9.X8_gB2c2rjmPyvI492CWjcHzPOBeemLLRcknrej3kLE)

# 5.   **测试框架设计**

采用Guider框架，编写sql脚本执行

# 6.   **测试环境说明**

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|单机+分布式|


# 7.  ** **  **工作量评估**

**工作量：5(人天)**

**计划测试完成时间：**

## Attachments:

[compression_level_ceil.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZWM4OTcwYzJhZjRmNTIwODAwIiwicmVmX2lkIjoiNjczOTZiZWM1OTNmOTljOWZmMjM2ODYwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3OTY3LCJleHAiOjE3ODIzODQzNjd9.UuN_i0UCAPs9G0W6MtkR4Y0jlEOefWrfKEz14eqeDs0)

 (application/octet-stream)    


[LSC压缩等级支持文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZWNhMWFkOWEzMzExZGM4Njc2IiwicmVmX2lkIjoiNjczOTZiZWM1OTNmOTljOWZmMjM2ODYwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3OTY3LCJleHAiOjE3ODIzODQzNjd9.X8_gB2c2rjmPyvI492CWjcHzPOBeemLLRcknrej3kLE)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


## Comments:

|  [](null)  ,会议纪要：,默认压缩后，需考虑补充创建非压缩表方案,Posted by yiwenliang at 十二月 14, 2023 18:06|
|---|
