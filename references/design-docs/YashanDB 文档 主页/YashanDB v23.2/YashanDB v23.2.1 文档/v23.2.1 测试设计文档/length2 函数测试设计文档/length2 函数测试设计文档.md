Created by 李凯峰, last modified on 十月 25, 2023

# 1.   **概述**

length2(expr) 返回当前参数的字符长度

# 2.   **需求分析**

- length2(expr) 返回当前参数的字符长度
- 不支持clob、blob、nclob字段（因为自定义数据类型返回值为clob，因此也不支持）
- 不支持BIT字段
- 当前仅支持heap表
- 永远使用UTF-16字符编码，不受数据库内置编码影响


# 3.   **测试设计方法**

主要采用的等价类划分，边界值  ，场景法组合及错误推测法进行设计

|输入条件|有效等价类|备注|无效等价类|备注|
|---|---|---|---|---|
|create table中使用|建表中使用length2（如default），在数据范围内|（tac/lsc建表时default使用length2函数是可以的，与开发确认建表走的行存，为非问题）|default 值超出数据类型边界值|查看拦截报错|
|表类型 |heap/普通表/分区表|仅支持行存，列存拦截|列存使用length2时报错|查看拦截报错|
|使用场景|select|覆盖128层length2自嵌套，ac，union，filter语法，如and/or/between and/in/not in/where/order/distinct/rownum/group by having/exists等|  
|  
|
|  
|insert|  
|  
|  
|
|  
|update|  
|  
|  
|
|  
|delete|  
|  
|  
|
|  
|insert into select|  
|  
|  
|
|  
|alter|alter列默认值|  
|  
|
|  
|view|  
|  
|  
|
|  
|PL/SQL中使用|for/if/then等语法|  
|  
|
|  
|多表|  
|  
|  
|
|入参|1.参数个数,2.入参为空,3.入参为null,4.入参为常量,5.入参边界值(16000),6.函数覆盖大小写|  
|  
|  
|
|字符编码|1.GBK,2.UTF-8,3.ASCLL,4.ISO-8859-I,  
|用例构造直接写成改种字符编码形式来入参|  
|  
|
|数据类型|覆盖如UDT、json等全数据类型|  
|clob/nclob/blob/bit/udt不支持(udt返回值为lob类型，因此不支持)|检查报错|
|配合索引使用|index|  
|  
|  
|
|约束|default、check|  
|  
|  
|
|返回值类型|typeof：bigint类型|  
|  
|  
|
|函数嵌套|如聚合函数、数学函数等|  
|  
|  
|
|并发/kill|  
|  
|  
|  
|


# 4.   **详细测试设计**

  


1）

[YDBRD-21634行存支持length2函数.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOTBhMWFkOWEzMzExZGM4M2UyIiwicmVmX2lkIjoiNjczOTZiOTA1OTNmOTljOWZmMjM2NDJjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1NTA1LCJleHAiOjE3ODIzODE5MDV9.qYD5jrN_lvVVfIeRS0ReUMqGtOAKZTy4rdNAJiZYheQ)

2）梳理该特性是否涉各个专项测试，并在详细设计中描述具体测试点

|专项|是否涉及|
|---|---|
|并发|涉及|
|长稳|不涉及|
|一致性|不涉及|
|三方测试工具    
  (sqltest，sqlancer)|不涉及|
|安全|不涉及|
|DFR/testkill|涉及|
|HA|不涉及|
|压力|不涉及|
|性能|不涉及|
|可维护性|涉及|


  


  


# 5.   **测试用例**

测试设计细化后的文本用例

详见附件

# 6.   **测试框架设计**

1. 使用GUIDER框架即可


# 7.   **测试环境说明**

|服务器类型|os|  
|
|:---|:---|:---|
|vm|centos|单机/集群|


  


[XXX功能测试设计.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOTBhMWFkOWEzMzExZGM4M2UzIiwicmVmX2lkIjoiNjczOTZiOTA1OTNmOTljOWZmMjM2NDJjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1NTA1LCJleHAiOjE3ODIzODE5MDV9.eiIKfFRKZygzlNkwY5g57vBhl3YKfsnc4kgrMZHSmDw)

## Attachments:

[XXX功能测试设计.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOTBhMWFkOWEzMzExZGM4M2UzIiwicmVmX2lkIjoiNjczOTZiOTA1OTNmOTljOWZmMjM2NDJjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1NTA1LCJleHAiOjE3ODIzODE5MDV9.eiIKfFRKZygzlNkwY5g57vBhl3YKfsnc4kgrMZHSmDw)

 (application/msword)    


[check.svg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOTA4OTcwYzJhZjRmNTIwNTZlIiwicmVmX2lkIjoiNjczOTZiOTA1OTNmOTljOWZmMjM2NDJjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1NTA1LCJleHAiOjE3ODIzODE5MDV9.DAUUTULOoehtXAT3pUFhZ4a2NMqB7cdbpGz6TM1JPg4)

 (image/svg+xml)    


[check.svg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOTBhMWFkOWEzMzExZGM4M2U0IiwicmVmX2lkIjoiNjczOTZiOTA1OTNmOTljOWZmMjM2NDJjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1NTA1LCJleHAiOjE3ODIzODE5MDV9.vEDyF66jqln2ukeu6sUpK5n6zScJDjq2ItitX5KD7fM)

 (image/svg+xml)    


[check.svg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOTBhMWFkOWEzMzExZGM4M2U1IiwicmVmX2lkIjoiNjczOTZiOTA1OTNmOTljOWZmMjM2NDJjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1NTA1LCJleHAiOjE3ODIzODE5MDV9.tm3xx_HjXYT_8OIdUgstueEehzI5uc6zkky1VR_Pe3Y)

 (image/svg+xml)    


[YDBRD-21634行存支持length2函数.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOTBhMWFkOWEzMzExZGM4M2UyIiwicmVmX2lkIjoiNjczOTZiOTA1OTNmOTljOWZmMjM2NDJjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1NTA1LCJleHAiOjE3ODIzODE5MDV9.qYD5jrN_lvVVfIeRS0ReUMqGtOAKZTy4rdNAJiZYheQ)

 (application/x-xmind)    
