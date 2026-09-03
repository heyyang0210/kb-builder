Created by 易文亮, last modified on 二月 19, 2024

# **1. 概述**

本文描述列存表延迟创建segments的测试设计

# **2. 需求分析**

SR：       [YDBRD-14018](https://jira.yasdb.com/browse/YDBRD-14018?src=confmacro)    -  【2023.1】LSC表建表支持延迟创建segment  完成

开发设计：    [【Spearfish】LSC表支持延迟创建segments - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=109052211)  

create table/alter add partition语法支持带segment creation [ immediate | deferred ]，默认都是延时创建，插数时才会创建segment

列存语法已支持，本次为功能实现

测试点：

1、验证延时创建和立即创建，alter增加分区带延时创建和立即创建，确认属性正确，确认segment生成逻辑跟语法一致

2、临时表不支持带延时创建语法

3、建表、drop空表性能有较大提升

4、列存分区表做了个优化，truncate表，未insert数据的分区不会删除segment

5、lsc的hash分区表暂不支持alter add分区

  


# **3. 测试**  **设计方法**   

测试设计主要采用等价类测试法进行设计

# 4.   **详细测试设计**

4.1 语法覆盖

|**输入条件**|**语句**|**有效等价类**|**编号**|**备注**|**无效等价类**|**编号**|**备注**|
|:---|:---|:---|:---|:---|:---|:---|:---|
|hash,list,range,interval|create table|带segment creation { immediate | deferred },默认不带，原逻辑heap/tac是延迟创建，lsc是立即创建,  
|1,2|  
|1、同时带immediate/deferred,2、关键字缺失,3、关键字错误,4、私有/全局临时表|9,10,11,12|  
    
|
|||带在表后,带在分区后,表和分区后都带|4,5,6|  
||||
||alter table xx add partition|带segment creation { immediate | deferred },默认不带,  
|7,8|  
|1、同时带immediate/deferred,2、关键字缺失,3、关键字错误,4、私有/全局临时表|13,14,15,16|  
|


4.2 功能验证

立即创建成功，dba_segments会新增相关记录；延迟创建是insert插数时才新建segment

  


4.3 性能验证

立即创建和延迟创建，10W/100W分区建表、insert数据、drop表性能，建表和drop表性能应该大幅提升，插数性能略微下降，综合性能提升。

  


  


# 5.   **测试用例**

[列存支持延迟创建测试设计(ydbrd14018).xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZjA4OTcwYzJhZjRmNTFmYjNmIiwicmVmX2lkIjoiNjczOTY5ZWY1OTNmOTljOWZmMjM1NDNjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwMTUzLCJleHAiOjE3ODIyOTY1NTN9.FvoU5n9Sjf9ChdnOiKrPXYbO5x6gS-3tpNNhFSd_bMA)

[YDBRD14018列存支持延迟创建segment测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZjA4OTcwYzJhZjRmNTFmYjQwIiwicmVmX2lkIjoiNjczOTY5ZWY1OTNmOTljOWZmMjM1NDNjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwMTUzLCJleHAiOjE3ODIyOTY1NTN9.pKgcaWAPWF2ds0HmOcwqort81XZQ48TFt0HoHeDLPi8)

# 6.   **测试框架设计**

自动化用例添加到YAT框架

# 7.   **测试环境说明**

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|单机+分布式|


## Attachments:

[列存支持延迟创建测试设计(ydbrd14018).xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZjA4OTcwYzJhZjRmNTFmYjNmIiwicmVmX2lkIjoiNjczOTY5ZWY1OTNmOTljOWZmMjM1NDNjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwMTUzLCJleHAiOjE3ODIyOTY1NTN9.FvoU5n9Sjf9ChdnOiKrPXYbO5x6gS-3tpNNhFSd_bMA)

 (application/x-xmind)    


[YDBRD14018列存支持延迟创建segment测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZjA4OTcwYzJhZjRmNTFmYjQwIiwicmVmX2lkIjoiNjczOTY5ZWY1OTNmOTljOWZmMjM1NDNjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwMTUzLCJleHAiOjE3ODIyOTY1NTN9.pKgcaWAPWF2ds0HmOcwqort81XZQ48TFt0HoHeDLPi8)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
