Created by 李美娥, last modified on 十一月 07, 2023

# **1. 概述**

本文描述sqlloader用户名和密码支持@/特殊字符的测试设计

# **2. 需求分析**

  [    需求：](https://jira.yasdb.com/browse/YDBRD-13629)      [YDBRD-13841](https://jira.yasdb.com/browse/YDBRD-13841?src=confmacro)    -  导入密码支持@  完成

    开发设计：    [YDBRD-13841：SQL LOADER CLIENT SUPPORT SPECIAL CHARACTER AS PW](https://conf.yasdb.com/pages/viewpage.action?pageId=122076743)  

  [CREATE USER | YashanDB Doc (yasdb.com)](https://cod-doc.yasdb.com/yashandb/alpha/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/SQL%E8%AF%AD%E5%8F%A5/CREATE%20USER.html)  

    sqlloader的用户名和密码规则，跟yasql对齐，规则如下：

![](https://pingcode.yasdb.com/atlas/files/public/673969668970c2af4f51f7e5/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjcxNjMsImV4cCI6MTc4MjEzNzk2M30.l46eHX7dITL_TKotEp8RgwphbgMyDsnNHX8oQ6c905E)

   此SR主要关注用户名和密码为特殊字符的测试+不能为双引号的容错。分布式和windows下的sqlloader仅挑选@/进行测试。不用考虑跟sqlloader功能的交互，此sr不会影响原有的sqlloader。

(备注：windows的包和sqlloader不交互给用户，暂不测试）

## 2.2 功能描述

（1）YashanDB 对标 ORACLE的SQL LOADER，参考实现相似的数据加载功能模块

（2）YashanDB参照SQL LOADER控制文件的语法，实现LOAD开头的SQL语句，通过执行该SQL语句调用YashanDB中的数据加载功能模块，将数据文件导入到表中。

## 2.3 功能限制

   同yasql，不支持指定为Null或者''，不支持带双引号。

# **3. 测试设计方法**

主要采用的等价类划分，边界值，场景法组合及错误推测法进行设计

|输入条件1|输入条件2|有效等价类|无效等价类|
|:---|:---|:---|:---|
|用户名|密码|1.    `%`    ，    `\`    ，    `;`    ，    `@`    ，    `/字符(@/不加转义字符，其他的还要加转义字符才可以）`  ,  `2.中文符合、。等、中文字。`  ,3.其他的符合~!#*( \n \t等（备注：\n \t支持）,4.用户名或者密码可以使用ip的形式,5.含空格（空格可以，要加转义）,6.含单引号(单引号可以，要加转义）|1.含双引号（带双引号的用户创建不了）,2.@Ip那多加个@符号的容错，用户和密码的中间/多一个或者是其他非/的符合的容错|


# 4.   **详细测试设计**

1）使用章节3的测试方法设计详细的测试点，可沿用xmind的方式

  


2）梳理该特性是否涉各个专项测试，并在详细设计中描述具体测试点

|专项|是否涉及|
|:---|:---|
|并发|否|
|长稳|否|
|一致性|否|
|三方测试工具    
  (sqltest，sqlancer)|否|
|安全|否|
|DFR/testkill|否|
|HA|否|
|压力|否|
|性能|否|
|可维护性|否|


# 5.   **测试用例**

测试设计细化后的文本用例

# 6.   **测试框架设计**

  


# 7.   **测试环境说明**

|**服务器**|** **|
|:---|:---|
|操作系统|Linux、windows（暂不测）|
|部署|  
|


## Attachments:

[image2022-9-19_10-39-1.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NjVhMWFkOWEzMzExZGM3NjUzIiwicmVmX2lkIjoiNjczOTY5NjU1OTNmOTljOWZmMjM0ZTMyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI3MTYzLCJleHAiOjE3ODIyMTM1NjN9.A8WuiENeGklxO0f2omzN7N5Wje_Ww1bnDpTKnmL1bhI)

 (image/png)    


[image2022-9-19_10-39-13.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NjY4OTcwYzJhZjRmNTFmN2RkIiwicmVmX2lkIjoiNjczOTY5NjU1OTNmOTljOWZmMjM0ZTMyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI3MTYzLCJleHAiOjE3ODIyMTM1NjN9.LYe9Z1ko8oHZUZUOu5jACT5jb8X8QmLqu8S12UaisTY)

 (image/png)    


[image2022-9-19_10-20-57.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NjY4OTcwYzJhZjRmNTFmN2RlIiwicmVmX2lkIjoiNjczOTY5NjU1OTNmOTljOWZmMjM0ZTMyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI3MTYzLCJleHAiOjE3ODIyMTM1NjN9.0eukzXIZP_exnh_scv61d0PbHnC_uzxoaTBR1DEgN5w)

 (image/png)    


[image2022-9-19_10-21-38.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NjZhMWFkOWEzMzExZGM3NjU2IiwicmVmX2lkIjoiNjczOTY5NjU1OTNmOTljOWZmMjM0ZTMyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI3MTYzLCJleHAiOjE3ODIyMTM1NjN9.c3nGEjC0z2-BEEvnx22IiwUjH5iGdqT2R2tP_VE2wDk)

 (image/png)    


[image2022-9-19_10-21-53.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NjZhMWFkOWEzMzExZGM3NjU3IiwicmVmX2lkIjoiNjczOTY5NjU1OTNmOTljOWZmMjM0ZTMyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI3MTYzLCJleHAiOjE3ODIyMTM1NjN9.pmeO4fdA8J2uq6MQGOinEhL2MA98a5mfMIR1nKrTzBA)

 (image/png)    


[image2022-9-19_10-35-48.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NjY4OTcwYzJhZjRmNTFmN2UyIiwicmVmX2lkIjoiNjczOTY5NjU1OTNmOTljOWZmMjM0ZTMyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI3MTYzLCJleHAiOjE3ODIyMTM1NjN9.JExagrbOXr6TUNeIaueAyHAMhYnDqZ59t2PuVNCeku4)

 (image/png)    


[sqlloader支持密码为@.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NjY4OTcwYzJhZjRmNTFmN2U0IiwicmVmX2lkIjoiNjczOTY5NjU1OTNmOTljOWZmMjM0ZTMyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI3MTYzLCJleHAiOjE3ODIyMTM1NjN9.7fCATIIVfWEW47fQDr7DAL_oP-tqPws39sZjvqELo_U)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
