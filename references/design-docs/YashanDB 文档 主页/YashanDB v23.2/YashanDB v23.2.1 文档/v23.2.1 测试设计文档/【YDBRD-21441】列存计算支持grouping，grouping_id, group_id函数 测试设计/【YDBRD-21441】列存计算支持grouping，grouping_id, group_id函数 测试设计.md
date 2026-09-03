Created by 严丽英, last modified on 十二月 19, 2023

# 1.   **概述**

  [YDBRD-21441](https://jira.yasdb.com/browse/YDBRD-21441?src=confmacro)    -  列存计算支持grouping，grouping_id, group_id函数  完成

TPCDS需要支持grouping函数

分布式聚合操作支持grouping, grouping_id, group_id  。

# 2.   **需求分析**

**2.1语法图：**

**Syntax:**  ** **

![](https://docs.oracle.com/en/database/oracle/oracle-database/21/sqlrf/img/grouping.gif?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTY3NjMsImV4cCI6MTc4MjMwNzU2M30.Th0rWmEg-yWXK9NeNVOKeAMm8m13iRkyHZUpzbnevVk)

**Syntax:**  ** **

![](https://docs.oracle.com/en/database/oracle/oracle-database/21/sqlrf/img/grouping_id.gif?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTY3NjMsImV4cCI6MTc4MjMwNzU2M30.Th0rWmEg-yWXK9NeNVOKeAMm8m13iRkyHZUpzbnevVk)

**Syntax:**  ** **

![](https://docs.oracle.com/en/database/oracle/oracle-database/21/sqlrf/img/group_id.gif?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTY3NjMsImV4cCI6MTc4MjMwNzU2M30.Th0rWmEg-yWXK9NeNVOKeAMm8m13iRkyHZUpzbnevVk)

  


**2.2 应用场景**

TPCDS需要支持grouping函数，grouping_id, group_id为类似用法

**2.3规格限制**

1. 当前设计不支持行执行，只支持单机列执行和分布式。
1. grouping参数个数限制为1个，grouping_id参数个数限制为1到126个，group_id参数个数限制为0个。
1. 函数参数的类型需要是能够成为group by列的，例如lob类型不能作为group by列，就不支持。
1. 必须结合group by进行使用，即这三个函数的参数（有参数的）必须出现在group by中。
1. 支持与其他普通函数的嵌套，但不支持与group函数嵌套:select grouping(sum(a)) from table group by a。
1. group by中可以为expr、rollup、cube、grouping sets但不支持  grouping、grouping_id、group_id出现在group by中，  即不支持select grouping(expr) from table group by grouping(expr)。
1. grouping、grouping_id函数不支持使用distinct: select grouping(distinct a) from table group by a。
1. grouping_id函数参数的个数最多支持126个，与oracle存在差异。
1. group_id返回的类型是int，oracle是number（但oracle的内部也可能是int）。
1. grouping(null)不支持


# 3.   **详细测试设计**

## **3.1测试设计方法**

内置函数入参-边界值，等价类。

其它场景采用-等价类

|输入条件|有效等价类|备注|无效等价类|备注|
|:---|:---|:---|:---|:---|
|入参|grouping：,1.参数个数：1,2.插入数据为null支持,2.函数大小写,4.支持入参类型能够成为group by列的：,tinyint/smallint/int/bigint/float/number/double,char/varchar,date/time/timestamp/ym interval/ds interval,boolean,/raw,5.  变量/常量  rownum/表达式/udf/plsql 绑定参数,  
,grouping_id：,1.参数个数：1-126,2.插入数据为null支持,2.函数大小写,3.支持入参类型：,tinyint/smallint/int/bigint/float/number/double,char/varchar,date/time/timestamp/ym interval/ds interval,boolean,/raw,4.  变量/常量  rownum/表达式/udf/plsql 绑定参数,  
,  
,group_id():,1.参数个数：0,2.函数大小写,3.双重括号：group_id(()),  
,  
|  
|grouping：,1.参数个数0-2,2.入参为null/为空/特殊字符/中文,3.函数拼写有误,4.括号为其它格式 ：  group_id{} /group_id[] /group_id（）,5.不支持类型不能成为group by列的：,blob/clob/json/  udt,6.   入参列不在group by列：  select grouping(a) from test group by b;,  
,grouping_id：,1.参数个数0-127,2.入参为null/为空/特殊字符/中文,3.函数拼写有误,4.不支持类型不能成为group by列的：,blob/clob/json/  udt,group_id():,  
,1.参数个数1-2,2.函数拼写有误|6.  rowid列存不支持|
|关键字|as 做别名/ 做表名/列名 后(在group by)|  
|  
|  
|
|type|typeof返回值类型|  
|  
|  
|
|filter|where/having,>、<、>=、<=、<>、!=、between and、in/not in、like/not like、exists/not exist,and/or、order by、connect by、limit/limit offset /fetch offset,  
|  
|  
|  
|
|  
|1.集合:union/unionall、intersect/intersect all/minus/minus all,1.join:,   inner join、left join、righe join、full join,3.子查询,   子查询的位置（在投影，在表  where...）,函数在having中|查询投影、子查询 having 子句、父查询的 having 子句、集合的两边|  
|  
|
|函数嵌套|decode/abs/upper/length/power/nullif/substr/concat/cast|  
|1.自嵌套：  grouping(grouping(a)),2.函数之间嵌套：/grouping(group_id())/grouping_id(grouping(a)) grouping_id(group_id()),3.与grouping sets/cube/rollup 嵌套,4.与avg/count/max/min/sum/stddev嵌套,5.与窗口函数嵌套,  
|  
|
|与  grouping sets/cube/rollup组合,  
,  
|grouping sets、cube、rollup  与表达式，常量组合查询：,1.子集完全相交,2.子集完全不相交,3.子集部分相交,（覆盖null,(),rowid/rownum,常量）|grouping sets(a,a,a,b),(a,b,c),(a,c),()  grouping sets 测试点 字段交集、不交集 为空 null|  
|  
|
|函数位置|1.在投影列 ：1)多个函数并列,                     2)与其它聚合函数运算/与或运算/||当成一个字符串,2./where/having/order by,3.distinct :   distinct grouping(a),4.grou by 结合以上where+having查询场景：,              1)group by+where+having：子查询/join/集合,             2)常量 普通列  /rowid/rownum/表达式,  
,  
|  
,group by 1/a/  /rowid/rownum/表达式|1.函数在非法位置: group by grouping(a);,2.grouping(distinct a)|  
|
|视图|materialize view/view,v$function,dual|走行拦截,指定hint走列 列存不支持|  
|  
|
|  
|create table... select,insert...select,update,delete|insert into select grouping(a) from..,update..where a in（select grouping(a) from ...,delete... where a in（select grouping(a) from ...|  
|  
|
|约束 |access/index|  
|  
|  
|
|表类型|tac/lsc,分区表、复制表 分布表|  
|  
|  
|


  


## 3.2     **详细测试设计**

|系统级DFX分类|是否涉及|
|:---|:---|
|CT|是|
|DFR|否|
|HA|否|
|KT|是|
|一致性|否|
|三方测试工具    
  (sqltest，sqlancer)|否|
|压力|否|
|可维护性|否|
|安全|否|
|性能|否 ：    [YDBRD-21510](https://jira.yasdb.com/browse/YDBRD-21510?src=confmacro)    -  列存计算支持hash grouping和并行  完成  sr会进行测试|
|长稳|是|


  


  


|dfx测试设计|  
|
|:---|:---|
|ct/kt|dml/dql 之间并发、dql/dql 之间并发|
|长稳|数据量较大的情况|
|  
|  
|


  


# 4.   **测试用例**

1.测试设计评审时提供冒烟文本用例；

2.启动测试之前提供文本用例，并完成大部分自动化用例；

详见附件

  


# 5.   **测试框架设计**

1. 如果用例不能实现自动化需要在此标注并说明原因
1. 确认使用的测试框架及其满足度


# 6.   **测试环境说明**

|服务器|  
|
|:---|:---|
|操作系统|linux|
|部署|单机、分布式|


  


# 7. 工作量评估

工作量：  *1人天*

计划测试完成时间：2023-11-27

## Attachments:

[image2023-12-16_14-23-18.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYmZhMWFkOWEzMzExZGM4NTJmIiwicmVmX2lkIjoiNjczOTZiYmY3MjgyMDZlZmI5MmYwOWQwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2NzYzLCJleHAiOjE3ODIzODMxNjN9.LTbbWgkKce86ZxapZN25_S7VgUUdEedOi47mhAqeCeI)

 (image/png)    


[grouing,grouping_id,group_id文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYmY4OTcwYzJhZjRmNTIwNmI4IiwicmVmX2lkIjoiNjczOTZiYmY3MjgyMDZlZmI5MmYwOWQwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2NzYzLCJleHAiOjE3ODIzODMxNjN9.RIcaDJcJij8y7SrPMc4iTKwstsPBX8OC1pYxj435ZWA)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[grouing,grouping_id,group_id文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYmY4OTcwYzJhZjRmNTIwNmI5IiwicmVmX2lkIjoiNjczOTZiYmY3MjgyMDZlZmI5MmYwOWQwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2NzYzLCJleHAiOjE3ODIzODMxNjN9.xmUp7Bj8jAIKgEDbLU1K57WZOO_-mWF6lrxkxBWP6Dk)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
