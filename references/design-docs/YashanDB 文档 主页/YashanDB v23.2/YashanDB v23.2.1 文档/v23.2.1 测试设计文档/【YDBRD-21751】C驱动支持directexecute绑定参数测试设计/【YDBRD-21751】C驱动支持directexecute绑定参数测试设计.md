Created by 许秋莹, last modified on 一月 06, 2024

# 1. 概述

本文主要内容为C驱动支持directexecute绑定参数的测试设计。

# 2. 需求分析

**2.1需求来源**

SR链接：    [YDBRD-18447](https://jira.yasdb.com/browse/YDBRD-18447?src=confmacro)    -  c驱动支持directExecute绑定参数  完成  --22.2

  [YDBRD-21751](https://jira.yasdb.com/browse/YDBRD-21751?src=confmacro)    -  【c驱动】支持directExecute绑定参数  完成  --23.2

  [YDBRD-21447](https://jira.yasdb.com/browse/YDBRD-21447?src=confmacro)    -  【c驱动】支持directExecute绑定参数  完成  --23.1

开发设计文档：    [c驱动支持directExecute绑定参数 - 刘亮杰 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=130123711)  

**2.2需求概述**

需求规格：  包含C驱动

功能概要：  directExecute支持绑定参数

**2.3涉及接口**

```
YacResult yacBindParameter(YacHandle hStmt, YacUint16 paramId, YacParamDirection direction, YacUint32 extType,
                           YacPointer value, YacInt32 size, YacInt32 bufLength, YacInt32* indicator)
  
YacResult yacDirectExecute(YacHandle hStmt, const YacChar* sql, YacInt32 sqlLength)
```

**2.4规格和约束**

1、支持的api调用顺序：先bindparameter之后一次directexecute，之后不允许加execute; 

2、参数列表校验在客户端做：增加客户端解析能力（个数）；

3、directexecute之后清理参数列表；

4、按名绑定暂不支持；

**2.5示例**

```
YAC_EXPECT_CALL(yacDirectExecute(stmt, "drop table if exists test_yacli", YAC_NULL_TERM_STR));
YAC_EXPECT_CALL(yacDirectExecute(stmt, "create table test_yacli(col1 int, col2 varchar(200))", YAC_NULL_TERM_STR));

YacInt32 inputInt;
YacChar inputVarchar[200];
YacInt32 indicator;
YAC_EXPECT_CALL(yacBindParameter(stmt, 1, YAC_PARAM_INPUT, YAC_SQLT_INTEGER, &inputInt, sizeof(YacInt32),sizeof(YacInt32), NULL));
YAC_EXPECT_CALL(yacBindParameter(stmt, 2, YAC_PARAM_INPUT, YAC_SQLT_VARCHAR2, (YacPointer)inputVarchar, 200, 200, &indicator));

inputInt = 99;
memcpy(inputVarchar, "0123456789", 10);
indicator = 10;
YAC_EXPECT_CALL(yacDirectExecute(stmt, "insert into test_yacli values(?, ?)", YAC_NULL_TERM_STR));

YAC_EXPECT_CALL(yacBindParameter(stmt, 1, YAC_PARAM_INPUT, YAC_SQLT_INTEGER, &inputInt, sizeof(YacInt32),sizeof(YacInt32), NULL));
YAC_EXPECT_CALL(yacBindParameter(stmt, 2, YAC_PARAM_INPUT, YAC_SQLT_VARCHAR2, (YacPointer)inputVarchar, 200, 200, &indicator));
```

# 3. 详细测试设计    

## 3.1 测试设计方法

本测试设计主要采用等价类划分和场景法组合进行设计，另外，本需求涉及的接口需要和其他接口结合进行使用，此部分主要用场景法进行测试设计。

## 3.2 详细测试设计

1.该特性为C驱动接口测试，不涉及DFX测试

2.详细测试设计

|输入条件|有效等价类|备注|无效等价类|备注|
|---|---|---|---|---|
| 绑定数据类型|boolean, tinyint, smallint, integer, bigint, float, double, number,,date, shorttime, timestamp,  interval year to month, interval day to second,,char, nchar, varchar, nvarchar, clob, blob, nclob|数字、字符、日期类型|  
|  
|
|PL/SQL对象|存储过程|  
|  
|  
|
|  
|匿名块|普通匿名块，cursor匿名块|  
|  
|
|  
|自定义函数|  
|  
|  
|
| 绑定形式|insert into test1 values (?,?,?)|  
|  
|  
|
|  
|insert into test1 values (:1, :2, :3)|  
|  
|  
|
|  
|insert into test1 values (:c1, :c2, :c3)|  
|  
|  
|
|bindparameter个数 和 实际绑定个数|bind个数 > insert 个数|  
|bind个数 < insert 个数|  
|
|  
|bind个数 = insert 个数|  
|  
|  
|
|invalid type|建表类型和bindparameter数据类型对应，绑定成功|  
|建表类型和bindparameter数据类型不对应，绑定失败|  
|
|bindparameter|bind out|参数3|  
|  
|
|  
|bind in|  
|  
|  
|
|  
|bind inout|  
|  
|  
|
|batch insert|获取正确的 batchRowsLen和batchErrorsLen|  
|  
|  
|
|yacBindParameter + ,yacDirectExecute|单次bind 单次execute|  
|单次bind 多次execute|  
|
|  
|多次bind 单次execute|  
|  
|  
|
|  
|多次bind 多次execute|  
|  
|  
|
|  
|  
|  
|  
|  
|


# 4. 测试用例

文本用例详见附件。

  


|用例名称|测试点|是否符合预期|备注|
|---|---|---|---|
|test_directexecute_1|数字类型 单次bind||  
|
|test_directexecute_2|字符类型 多次bind||  
|
|test_directexecute_3|日期类型||  
|
|test_directexecute_4|batch insert||~~待开发确认 已解决~~|
|test_directexecute_5|batch insert||  
|
|test_directexecute_6|绑定形式||  
|
|test_directexecute_7|invalid type||  
|
|test_directexecute_8|bindparameter个数 和 实际绑定个数||  
|
|test_directexecute_9|匿名块 cursor||~~core 已提单~~|
|test_directexecute_10|匿名块 普通数据类型||  
|
|test_directexecute_11|存储过程 cursor||  
|
|test_directexecute_12-20|原有bind out用例改写||  
|
|test_directexecute_21|自定义函数||  
|
|test_directexecute_22|自定义函数 cursor||  
|
|test_directexecute_23-30|原有bind out用例改写||  
|


# 5. 测试框架设计

1. 使用C API 结合cunit框架进行测试


# 6. 测试环境说明

|机器|内存|版本|数据库|
|:---|:---|:---|:---|
|192.168.18.85|31G|CentOS Linux release 7.9.2009 (Core)|开发提供安装包|


# 7. 工作量评估

工作量：7  *人天*

计划测试完成时间：2023.10.31

## Attachments:

[image2023-10-9_15-57-13.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYzRhMWFkOWEzMzExZGM4NTQ1IiwicmVmX2lkIjoiNjczOTZiYzM1OTNmOTljOWZmMjM2NmNkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2ODQ5LCJleHAiOjE3ODIzODMyNDl9.E2xy444QGn4wFEAbWuQyF8W7l8tPIWqjg2Viu98IOCk)

 (image/png)    


[image2023-10-9_14-36-4.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYzQ4OTcwYzJhZjRmNTIwNmNkIiwicmVmX2lkIjoiNjczOTZiYzM1OTNmOTljOWZmMjM2NmNkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2ODQ5LCJleHAiOjE3ODIzODMyNDl9.fkqk_oc8ZbSf-88TnwffOw3904QayiD3MRFlXPwV5y8)

 (image/png)    


[image2023-10-8_19-2-35.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYzRhMWFkOWEzMzExZGM4NTQ2IiwicmVmX2lkIjoiNjczOTZiYzM1OTNmOTljOWZmMjM2NmNkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2ODQ5LCJleHAiOjE3ODIzODMyNDl9.8Pb6HZkJsJa7n7VidXY0tCVy4XqmaUHPP8b9NFHLC60)

 (image/png)    


[image2023-10-8_19-1-55.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYzQ4OTcwYzJhZjRmNTIwNmNlIiwicmVmX2lkIjoiNjczOTZiYzM1OTNmOTljOWZmMjM2NmNkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2ODQ5LCJleHAiOjE3ODIzODMyNDl9.J2v0CT0xIqQJ3m0LZJQbAnD28UblV49joMsAqBhqI28)

 (image/png)    


[image2023-10-8_18-59-33.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYzQ4OTcwYzJhZjRmNTIwNmNmIiwicmVmX2lkIjoiNjczOTZiYzM1OTNmOTljOWZmMjM2NmNkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2ODQ5LCJleHAiOjE3ODIzODMyNDl9.gHZnecxNZSttH1IPu2gSOdmeyH52UUxdhL3u1iVoQfQ)

 (image/png)    


[YDBRD21751-文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYzQ4OTcwYzJhZjRmNTIwNmQwIiwicmVmX2lkIjoiNjczOTZiYzM1OTNmOTljOWZmMjM2NmNkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2ODQ5LCJleHAiOjE3ODIzODMyNDl9.mmDDL6bGFcNYurJENeYDVE_Z4KwSAFuL3NDO9R9N2Is)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[YDBRD21751-文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYzQ4OTcwYzJhZjRmNTIwNmQxIiwicmVmX2lkIjoiNjczOTZiYzM1OTNmOTljOWZmMjM2NmNkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2ODQ5LCJleHAiOjE3ODIzODMyNDl9.tHgDWp7zln0cIU07Kd2-Dr7u7Vn6W2j3nmpfLZqsPn8)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
