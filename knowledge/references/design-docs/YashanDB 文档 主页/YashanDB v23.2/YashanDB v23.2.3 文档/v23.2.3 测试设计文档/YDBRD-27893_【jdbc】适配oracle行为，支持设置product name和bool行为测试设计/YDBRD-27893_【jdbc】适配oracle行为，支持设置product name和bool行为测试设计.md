Created by 李潮, last modified on 三月 04, 2024

# **1. 概述**

SR:        [YDBRD-27893](https://jira.yasdb.com/browse/YDBRD-27893?src=confmacro)    -  【jdbc】适配oracle行为，支持设置product name和bool行为  完成

参考：开发设计文档：    [【YDBRD-27893】适配Oracle行为需求概要设计文档](144136593.html)  

jdbc setBoolean与oracle适配

jdbc setNull  适配hibernate行为

jdbc product name行为与oracle进行适配，方便向第三方件提供product name参数

# **2. 需求分析**

## 2.1 功能介绍

jdbc通过setBoolean接口写入服务端为int类型，与oracle一致

jdbc通过setNull接口写入服务端为统一的  DataType.UNKOWN  类型，  适配hibernate行为

jdbc通过url设置  productName  =  oracle，通过  get  DatabaseProductName获取到ProductName，方便第三方件能过获取product name参数，与oracle一致

## 2.2范围

交付版本：br22.2  master

交付形态：单机，分布式，集群

## 2.3 规格约束

无

# **3 详细测试设计**

**1.preparement.setBoolean——已有用例覆盖，执行查看结果**

**setBoolean对整数类型，字符类型，boolean类型，bit类型等设置true,false后并进行查询，查看jdbc表现和服务端表现，预期字符相关类型查询结果发生变化**

**setBoolean对binary_xxx,raw,时间类型，raw类型，xmltype,大数据类型，rowid, xmltype,json,urowid等不支持setBoolean类型设置false，查看jdbc表现，是否报错及报错信息是否变化**

  


**2.preparement.setNull——已有用例覆盖，执行查看结果**

**setNull对所有类型进行设置后，查看jdbc表现和服务端表现**

  


**3.url+**  **DatabaseMetaData.**  **getDatabaseProductName**

|**productName**|**getDatabaseProductName**|
|---|---|
|不进行配置|YashanDB|
|配置参数|  
|


**补充：**

**对第三方件(activiti)，测试url配置**  **productName进行连接是否成功——不用关注**

**因为yasft工程用例有部分使用jdbc，通过上车，识别出需要刷新预期用例**

**通过上车识别jdbc工程其他预期变更，确认是否合理**

  


专项测试设计情况：

|专项|是否涉及|
|:---|:---|
|并发|否|
|可靠性|否|


# **4 冒烟用例**

  


   电子表格

# **5 **  **文本用例**

  
    
    


# **5 测试框架设计**

Gradle

  


  


## Attachments:

[YDBRD-27893文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMGU4OTcwYzJhZjRmNTIxMDA5IiwicmVmX2lkIjoiNjczOTZkMGU1OTNmOTljOWZmMjM3NzQ3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1NTg1LCJleHAiOjE3ODIzOTE5ODV9.ZsgNE64D4v1wC1YmuoenFyCnhXPv2zsnRNH2Dag7OAU)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[YDBRD-27893冒烟用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMGU4OTcwYzJhZjRmNTIxMDBhIiwicmVmX2lkIjoiNjczOTZkMGU1OTNmOTljOWZmMjM3NzQ3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1NTg1LCJleHAiOjE3ODIzOTE5ODV9.VRzpktyRbEDZvBUGuPQcfzx-pmKGIJFA1U2HNCs3mNo)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[image2024-3-4_14-46-17.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMGU4OTcwYzJhZjRmNTIxMDBiIiwicmVmX2lkIjoiNjczOTZkMGU1OTNmOTljOWZmMjM3NzQ3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1NTg1LCJleHAiOjE3ODIzOTE5ODV9.rvdX1KwmvKFpZUr_1O8Af4zayBHaALym6lmMYEEmdU4)

 (image/png)    


[image2024-3-4_14-46-28.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMGVhMWFkOWEzMzExZGM4ZTdhIiwicmVmX2lkIjoiNjczOTZkMGU1OTNmOTljOWZmMjM3NzQ3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1NTg1LCJleHAiOjE3ODIzOTE5ODV9.18qN-oIzq3FlsJXc7kHMecDwgaAcmB4SH5MdBPDXZr4)

 (image/png)    


[YDBRD-27893冒烟用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMGVhMWFkOWEzMzExZGM4ZTdiIiwicmVmX2lkIjoiNjczOTZkMGU1OTNmOTljOWZmMjM3NzQ3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1NTg1LCJleHAiOjE3ODIzOTE5ODV9.26nKhKJKiPMxptlvueZQ65pFbXIPS5mQbz22Ag4g1aQ)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[1.jpg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMGU4OTcwYzJhZjRmNTIxMDBjIiwicmVmX2lkIjoiNjczOTZkMGU1OTNmOTljOWZmMjM3NzQ3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1NTg1LCJleHAiOjE3ODIzOTE5ODV9.g5ZgYe2NJca3y6rtv6dwoFJIGlDAHDFPhMv2ZMEF4Ao)

 (image/jpeg)    


## Comments:

|  [](null)  ,参会人员：张周玺、方少奎、施新华、李潮。,评审时间：2024.3.4  15:30    
  评审地点：#腾讯会议：651-924-103,  
  评审纪要：,1、setBoolean对于原本不支持的数据类型，如大数据类型，表现可能变更为支持,2、product name，对第三方件，只要测试  DatabaseMetaData.  getDatabaseProductName能过获取到product name信息即可，不需要耗费精力搭载第三方件进行测试。,3、交付范围与部署方式无关,Posted by lichao at 三月 04, 2024 15:55|
|---|
