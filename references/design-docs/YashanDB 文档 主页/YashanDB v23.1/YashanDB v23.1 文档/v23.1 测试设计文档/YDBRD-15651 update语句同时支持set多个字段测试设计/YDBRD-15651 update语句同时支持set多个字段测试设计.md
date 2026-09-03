Created by 刘清萍, last modified on 十月 15, 2024

# 1.   **概述**

描述  update同时set多个字段测试设计

sr：    [[](https://jira.yasdb.com/browse/YDBRD-13633)      [update语句同时支持set多个字段](https://jira.yasdb.com/browse/YDBRD-15618)  

开发文档：    [YDBRD-15618 update支持同时set多个字段](https://conf.yasdb.com/pages/viewpage.action?pageId=113976325)  

  [YDBRD-15651](https://jira.yasdb.com/browse/YDBRD-15651?src=confmacro)    -  update语句同时支持set多个字段  完成

# 2.   **需求分析**

当前yasdb不支持update同时set多个字段的语法，YDBRD-15618支持update同时set多个字段语法，支持的语法形式如下：

**以下支持的语法不报错当前update set expr里面是单列的形式，只包括本次SR增加的支持语法**

**单表**  ：set expr可以是子查询或者values，但是同一个set expr不能子查询和values都有（default表达式与values同类，所以default表达式和子查询不能在一个set expr里面）。     **备注：oracle 只支持set expr是子查询，不能是values**

**多表：**  需要打开mysql开关alter system set sql_plugin = 'MYSQL' scope = memory;

|set expr|单表|多表|
|:---|:---|:---|
|子查询|update t1 set (c1,c2) = (select 1,2 from dual);|update t1,t2 set (t1.c1, t1.c2) = (select 1,2 from dual), t2.c1 = (select 2 from dual);|
|values|update t1 set (c1,c2) = (2, 3), (c3, c4) = (1, 2);|update t1,t2 set (t1.c1, t1.c2) = (2, 3), t2.c1 = (4);|
||update t1 set (c1) = 3;|update t1, t2 set (t1.c1) = 3, (t2.c1) = 4;|
|  
|update t1 set (c1,c2) = (select 1,2 from dual)，(c3, c4) = (2, 3);|update t1,t2 set (t1.c1, t1.c2) = (select 1,2 from dual), t2.c1 = (4);|
|default|update t1 set (c1,c2) = default;|update t1,t2 set (t1.c1, t1.c2) = default, t2.c1 = (4);|
||update t1 set (c1,c2) = (default, 3);|update t1,t2 set (t1.c1, t1.c2) = (default, 4), t2.c1 = (4);|


  


- ### oracle、mysql 目前支持语法：
- ### oracle
- ### update t1 set c1 = (select 1 from dual), c2 = (select 2 from dual);
- ### update t1 set (c1,c2) = (select 1,2 from dual);
- ### update t1 set (c1,c2) = (select 1,2 from dual), (c3, c4) = (select 1,2 from dual);
- ### update t1 set (c1,c3) = (select 1,2 from dual), (c2, c4) = (select 1,2 from dual);
- ### 目前报错：update t1 set (c1,c2) = (1,2);
- ### mysql
- ### update t1,t2 set t1.c1 = (select 1 from dual), t2.c1 = (select 2 from dual);
- ### 目前报错：update t1,t2 set (t1.c1, t1.c2)= (select 1,2 from dual), t2.c1 = (select 2 from dual);
- ### 目前报错：update t1,t2 set (t1.c1, t2.c1)= (select 1,2 from dual), t2.c2 = (select 2 from dual);
- ### 目前报错：update t1,t2 set (t1.c1, t2.c1)= (1,2);


# 3.   **测试设计方法**   

主要采用的等价类划分，边界值，场景法组合及错误推测法进行设计 

**第二个set用了第一个set列**

# 4.   **详细测试设计**

|输入条件|有效等价类|备注|无效等价类|备注|
|:---|:---|:---|---|---|
|新增语法(单表)|一个子查询|update t1 set (c1,c2) = (select 1,2 from dual);|子查询values混合|update t1 set (c1,c2) = (2, (select 3 from dual))|
|  
|values（包含null值|**null、表达式、普通函数、实际值**|一个列不能同时set两次|update t1 set (  **c1,**  c2) = (select 1,2 from dual)，(  **c1**  , c4) = (2, 3);|
|  
|组合|update t1 set (c1,c2) = (select 1,2 from dual)，(c3, c4) = (2, 3);|  
|  
|
|  
|set 单列带括号|update t1 set (c1) = 3;|  
|  
|
|  
|加default （null处理）|  
|default和子查询|  
|
|  
|  
|  
|  
|  
|
|新增语法（多表）---打开mysql开关|子查询|  
|多表set括号里面出现多表列|update t1,t2 set (  **t1.c1, t2.c2**  ) = (select 1,2 from dual), t2.c1 = (4);|
|  
|values（包含null值|**null、表达式、普通函数、实际值**|一个列不能同时set两次|  
|
|  
|单列带括号|  
|子查询values混合|  
|
|  
|加default|  
|default和子查询|  
|
|**组合trigger**|单表、多表 |触发update操作|  
|  
|
|  
|报错|  
|  
|  
|
|组合sequence|多次使用|  
|  
|  
|
|数据类型|  
|  
|**update多列不允许set udt类型**|  
|
|set列|set列数量等于value个数|  
|大于 小于 空列|报错异常待确认|
|  
|set列数量等于投影列个数|  
|大于 小于 空列|  
|
|  
|**set列乱序**|乱序涉及重排|  
|  
|
|  
|set列数量限制---4096|  
|  
|  
|
|select后跟投影列类型|单列|**（使用set列，不使用set列）**|  
|  
|
|  
|表达式列 ，函数列 |普通函数 ，聚集函数 ，窗口函数|  
|  
|
||伪列|rownum ， rowid ，rowscn|  
|  
|
|  
|标量子查询|  
|  
|  
|
|  
|常量|  
|  
|  
|
|  
|**sysdate**  ，systimestamp|**多次使用**   （多表注意测试）|  
|  
|
|  
|**结果是零行**|插入null值|  
|  
|
|待 update 表约束|not null----default|单列约束，多列约束|  
|  
|
|  
|check |  
|  
|  
|
|  
|unique|  
|  
|  
|
|  
|主键 |  
|  
|  
|
|  
|外键|  
|  
|  
|
|  
|**分区键**|多个分区键乱序，分区键和非分区键组合|  
|  
|
|select语句|**join**|inner ，left ，right ，full （  **是否使用update表 结果大于一条**  ）|select后join使用 父表 （oracle支持）,限制报错 right outer join" has not been implemented yet  (oracle支持)|  
|
|  
|connect by|  
|  
|  
|
|  
|集合操作|union ，intersect，minus|  
|  
|
|  
|distinct|  
|  
|  
|
|  
|group by   having |  
|  
|  
|
|  
|order by |  
|  
|  
|
|  
|limit + offset|  
|  
|  
|
|  
|in /not in|in list,in subquery|  
|  
|
|  
|exists/not exists|  
|  
|  
|
|  
|关联子查询，非关联子查询|  
|  
|  
|
|  
|like，not like|  
|  
|  
|
|  
|between and|  
|  
|  
|
|  
|is null， is not null|  
|  
|  
|
|  
|any，all，some|  
|  
|  
|
|update表类型|**table(普通表）----单机行表、列表tac**|lsc之后补用例|  
|  
|
|  
|分区表|interval，hash，range，list|  
|  
|
|子查询返回值|多列单行|  
|多行多列|  
|
|  
|单行单列|  
|多行单列|  
|
|**merge**|语法验证|  
|组合trigger 原有限制|  
|
|  
|基本功能|  
|  
|  
|
|**insert on duplicate**|语法验证|  
|  
|  
|
|  
|组合trigger|  
|  
|  
|
|  
|  
|  
|  
|  
|


# 5.  ** 测试用例设计**

文本用例：

[update多个字段文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5OWRhMWFkOWEzMzExZGM3N2VmIiwicmVmX2lkIjoiNjczOTY5OWQ3MjgyMDZlZmI5MmVmNTE0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA3NzI1LCJleHAiOjE3ODIyOTQxMjV9.-lXW8GOUz8ODjTzxUtLn__L3cMaqll8mq8JAeGawiTQ)

# 6.   **测试框架设计**

  


# 7.   **测试环境说明**

## Attachments:

[check.svg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5OWRhMWFkOWEzMzExZGM3N2YxIiwicmVmX2lkIjoiNjczOTY5OWQ3MjgyMDZlZmI5MmVmNTE0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA3NzI1LCJleHAiOjE3ODIyOTQxMjV9.rroGAMAd8V9aKDcJXP4tHQfRlrZeuTONyrKXfEWLalA)

 (image/svg+xml)    


[check.svg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5OWQ4OTcwYzJhZjRmNTFmOTdiIiwicmVmX2lkIjoiNjczOTY5OWQ3MjgyMDZlZmI5MmVmNTE0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA3NzI1LCJleHAiOjE3ODIyOTQxMjV9.ddwU3JrhYpxeFHgGULQ1WZbl0FBFgHEEzNCF62EfgQU)

 (image/svg+xml)    


[check.svg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5OWQ4OTcwYzJhZjRmNTFmOTdjIiwicmVmX2lkIjoiNjczOTY5OWQ3MjgyMDZlZmI5MmVmNTE0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA3NzI1LCJleHAiOjE3ODIyOTQxMjV9.xQuiHoG_GsN05mqaaN1Qn9ZDcXaqsn196ebm0VrQny4)

 (image/svg+xml)    


[check.svg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5OWQ4OTcwYzJhZjRmNTFmOTdkIiwicmVmX2lkIjoiNjczOTY5OWQ3MjgyMDZlZmI5MmVmNTE0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA3NzI1LCJleHAiOjE3ODIyOTQxMjV9.GXIuHYNSF_tn4uQRKY2Rh04Grgz8czsLOFuuhASXyXs)

 (image/svg+xml)    


[check.svg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5OWRhMWFkOWEzMzExZGM3N2YzIiwicmVmX2lkIjoiNjczOTY5OWQ3MjgyMDZlZmI5MmVmNTE0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA3NzI1LCJleHAiOjE3ODIyOTQxMjV9.ckApgjCLAn6Y0juHd-KImv1laJBXnQpDIGzvBuWbsu8)

 (image/svg+xml)    


[check.svg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5OWQ4OTcwYzJhZjRmNTFmOTdlIiwicmVmX2lkIjoiNjczOTY5OWQ3MjgyMDZlZmI5MmVmNTE0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA3NzI1LCJleHAiOjE3ODIyOTQxMjV9.aEENIrzY79HxzZozU3juh9ZwCNSyAf3dMFQmKYe95_o)

 (image/svg+xml)    


[check.svg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5OWRhMWFkOWEzMzExZGM3N2Y1IiwicmVmX2lkIjoiNjczOTY5OWQ3MjgyMDZlZmI5MmVmNTE0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA3NzI1LCJleHAiOjE3ODIyOTQxMjV9.bi24PTqGTLbWCzeO2NplLivc6-hRg_RybgFBRtRO4-o)

 (image/svg+xml)    


[check.svg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5OWRhMWFkOWEzMzExZGM3N2Y2IiwicmVmX2lkIjoiNjczOTY5OWQ3MjgyMDZlZmI5MmVmNTE0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA3NzI1LCJleHAiOjE3ODIyOTQxMjV9.S7KlBRL_bT6buBZn8R69J5ZsAF_wzjBCFuxI1WyAY3o)

 (image/svg+xml)    


[check.svg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5OWQ4OTcwYzJhZjRmNTFmOTgwIiwicmVmX2lkIjoiNjczOTY5OWQ3MjgyMDZlZmI5MmVmNTE0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA3NzI1LCJleHAiOjE3ODIyOTQxMjV9.p5lAQaLjguZr0FSMn6lNGZQCdhwrWP6L_-4uGvRTHUg)

 (image/svg+xml)    


[check.svg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5OWRhMWFkOWEzMzExZGM3N2Y3IiwicmVmX2lkIjoiNjczOTY5OWQ3MjgyMDZlZmI5MmVmNTE0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA3NzI1LCJleHAiOjE3ODIyOTQxMjV9._vMDqxt6GVhRCT4AaebbeB5_exwWmMaK5kSIWOEKlyQ)

 (image/svg+xml)    


[check.svg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5OWQ4OTcwYzJhZjRmNTFmOTgxIiwicmVmX2lkIjoiNjczOTY5OWQ3MjgyMDZlZmI5MmVmNTE0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA3NzI1LCJleHAiOjE3ODIyOTQxMjV9.5m5jj91JTrIbE16APnq4CCrJv1Dmk7GfHpN5wDcGrM8)

 (image/svg+xml)    


[update多个字段文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5OWRhMWFkOWEzMzExZGM3N2Y4IiwicmVmX2lkIjoiNjczOTY5OWQ3MjgyMDZlZmI5MmVmNTE0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA3NzI1LCJleHAiOjE3ODIyOTQxMjV9.NQamf2_HIBrnjTeDEBz7Gxw3FDMGnF2QHBYzcHTyH3o)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[update多个字段文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5OWRhMWFkOWEzMzExZGM3N2VmIiwicmVmX2lkIjoiNjczOTY5OWQ3MjgyMDZlZmI5MmVmNTE0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA3NzI1LCJleHAiOjE3ODIyOTQxMjV9.-lXW8GOUz8ODjTzxUtLn__L3cMaqll8mq8JAeGawiTQ)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
