Created by 严丽英, last modified on 十二月 29, 2023

# 1.   **概述**

  [YDBRD-21639](https://jira.yasdb.com/browse/YDBRD-21639?src=confmacro)    **-**  **行存to_date支持儒略日转换**  **完成**

  [YDBRD-21640](https://jira.yasdb.com/browse/YDBRD-21640?src=confmacro)    **-**  **行存to_char支持日期按照儒略周期转换成计数**  **完成**

  


to_date和to_char支持儒略日转换

1、to_date支持儒略日计数整数转换成日期，to_date(str,‘J’)    
  2、to_char支持日期按照儒略周期转换成计数，to_char(date,'JSP')、to_char(date,'J')

  


# 2.   **需求分析**

select to_date(2451545,'J') from dual;

TO_DATE(2451545,'J    
  ------------------    
  01-JAN-00

  


select to_char(sysdate,'JSP') from dual;

TO_CHAR(SYSDATE,'JSP')    
  ------------------------------------------------------------------------------    
  TWO MILLION FOUR HUNDRED SIXTY THOUSAND TWO HUNDRED SEVENTY-SEVEN

  


select to_char(sysdate,'J') from dual;

TO_CHAR    
  -------    
  2460277

  


  


  


**2.2 应用场景**

**2.3规格限制**

to_date支持儒略日实现：    
  1. to_date仅支持格式符'J’    
  2. 支持输入的儒略日计数范围 [1, 1721057] ∪ [1721424, 5373484]    
  3. 输出公元前的年份为正数， 不支持输出负数年份    
  4. 2299161计数对应日期为1582-10-15， 2299160计数对应日期为1582-10-04，中间时间因为历法修改跳过。

5.  返回date类型

  
  to_char支持儒略日实现：    
  1. to_char支持格式符 'J' 'JSP'    
  2. 支持年份为[0001, 9999], 不支持输入负数年份    
  3.第一个参数必须为datetime类型    
  4.1582-10-05到1582-10-15对应儒略日计数为2299161

5.‘jsp’其中‘j’大写且‘s’大写，则输出大写全拼。‘j’大写且‘s’小写，则输出单词首字母大写。‘j’小写则输出小写全拼

5.  返回字符

  


# 3.   **详细测试设计**

## **3.1测试设计方法**

入参范围采用边界值

其它场景采用等价类

|  
|输入条件|有效等价|备注|无效等价|备注|
|---|---|---|---|---|---|
|to_date|入参,  
,  
|1.入参范围[1, 1721057] ∪ [1721424, 5373484],2.j默认取7位数，前导为0场景,select to_date(0000001,'J') from dual;,3、入参为表达式,select to_date(1721424+1,'j') from dual;,to_date(1721424-1,'j'),asb+1,to_date(abs(c1)+1,'j'),  
,4.入参为表中字段（能转换的支持）,  [heap:/nchar/nvarchar/bit](http://heap/nchar/nvarchar/nclob/blob/clob/bit/)  ,tinyint/smallint/int/bigint/float/number/double,char/varchar,/raw/    [nclob/blob/clob](http://heap/nchar/nvarchar/nclob/blob/clob/bit/)  ,5 特殊计数[ 2299160 2299161],6、为null  /rownum,7、参数个数|  
|1、特殊字符#。@ ，中文，英文a, 非整数（小数，负数）,  
,2、0，1721058，1721059,1721422，1721423，,5373485，5373486,-1，,-1721057,-1721424,-5373484,3、不支持不能转换成字符串的类型   ,4、  XMLTYPE/json/boolean,  
|  
|
|  
|隐式转换|to_char，cast,date，to_number:,select to_date(to_char(1111),'J') from dual; to_date(to_char(to_date(1721424,'j'),'j'),'j')from dual;,select to_date(cast('1' as char) ,'j' ) from dual;,select to_date(to_number(1111),'J') from dual;|  
|to_timestamp,  
,  
|  
|
|  
|格式符|大小写 j,J,  
|  
|jsp ,jj,j-j,j j,j-y-j，j-sp,格式符不带引号：select to_date(1582, j )from dual;|  
|
|  
|j与format组合,  
,  
,  
|J与format大小写组合,select to_date('17214240001', 'jyyYY') from dual;,  
,j与连接符,j与yyyy/yyy/yy/y：,select to_date('17214240001', 'jyyyy') from dual;,select to_date('1721424-1', 'j-y') from dual;,j与mm：,select to_date('1721424 01', 'j mm') from dual;,j与dd：,select to_date('1721424/01', 'j/dd') from dual;,j与hh：,select to_date('1721424;01', 'j;hh') from dual;,j与mi：,select to_date('1721424;01', 'j;mi') from dual;,j与ss：,select to_date('1721424;01', 'j;ss') from dual;,format为中文：,select to_date('1721424-0001', 'j-yy”年“') from dual;,j与yyyy-mm-dd hh-mi-ss：,select to_date('1721424-01:01/01 01;01 01', 'j-yyyy:mm/dd hh;mi ss') from dual;,  
,format在j前面覆盖以上场景重点,有分隔符、无分割符,select to_date('0001-1721424', 'yyyy-j') from dual;,select to_date('00011721424', 'yyyyj') from dual;,特殊计数  [ 2299160 2299161]与fmt：,select to_date('22991611582','jyyyy')from dual;|匹配规则：,1.[1721424, 5373484]年份支持,2.通过to_date返回日期匹配,select to_date(1721424,'j')from dual;,TO_DATE(1721424,'J'    
  -------------------    
  0001-01-01 00:00:00,  
,3. j匹配前7位，后面依次与fmt匹配,select to_date('1721424-0001-01-01','j-yyyy-mm-dd')from dual;,TO_DATE('1721424-00    
  -------------------    
  0001-01-01 00:00:00,  
,  
,  
,  
,  
,  
,  
,  
,  
|[1, 1721057]年份与fmt匹配会和Julian 日期发生冲突,select to_date('1 4712', 'j yyyy') from dual;,非to_date返回外的日期报错,select to_date('1721424 02', 'j mm') from dual;,超出j位数报错：,select to_date('17214240-01', 'j-mm') from dual;,参数不带年份，j含format,select to_date('1721424', 'j-yyyy') from dual;,fmt在j前面覆盖以上异常场景,  
,  
|  
|
|  
|设置alter session set nls_date_format = 'yyyy';,可返回成功|select to_date(to_date('2021-11-11','yyyy-mm-dd'),'J')from dual;,  
|  
|  
|  
|
|  
|plsql| 绑定参数/json格式绑定参数|  
|  
|  
|
|  
|位置|在投影列,在where，having，group by ,order by,distinct,select to_date(c1,'j')from dual where to_date(c1,'j')>10;|  
|  
|  
|
|  
|  
|typeof|  
|  
|  
|
|  
|视图|view/materialized view|  
|  
|  
|
|  
|  
|crate table as select...,insert into select,update..where a in,delete... where a in,update..where a in(select to_char(c1,'j')from dual where to_char(c1,'j')>10;),  
|  
|  
|  
|


|  
|**输入条件**|**有效等价**|**无效等价**|**备注**|
|---|---|---|---|---|
|to_char|入参,  
,alter session set nls_date_format = 'yyyy-mm-dd';|范围：[0001, 9999],1、为datetime类型,select to_char(sysdate,'j')from dual;,select to_char(systimestamp,'j')from dual;,select to_char(date'2012-11-01','j')from dual;,2、入参为表达式：,select to_char(to_date(2022-12-12)+1,'j')from dual;,select to_char(to_date(abs(2022-12-12)+1,'j'))from dual;,abs,abs+1,  
,3、入参为表中字段（其它类型通过to_date转换后支持）,date/timestamp/,  
,4、特殊年份：1582-10-05到1582-10-15,4.为null  /rownum,  
,  
,  
,  
|0000，10000,-0001，,-9999,常量，特殊字符#。@ ，中文，a，其它数据类型, 非整数（小数，负数）,  [heap:/nchar/nvarchar/nclob/blob/clob/bit/](http://heap/nchar/nvarchar/nclob/blob/clob/bit/)    XMLTYPE,tinyint/smallint/int/bigint/float/number/double,char/varchar,boolean,/raw,/json,/udt,/rowid/表达式/udf,  
,  
,格式：,select to_char(2023-12-06,'J') from dual;,select to_char('2023-12-06','J') from dual;,  
,  
|j jsp：  ym interval/ds interval 不生效 不报错,  
,SQL> select to_char(ym1,'jsp')from tab_YDBRD13651_13;,TO_CHAR(YM1,'J    
  --------------    
  +000000001-02,SQL> select to_char(ds1,'jsp')from tab_YDBRD13651_13;,TO_CHAR(DS1,'JSP')    
  ---------------------------    
  +000000010 10:10:10.000000|
|  
|隐式转换|to_date，cast，,select to_char(to_date(1582-10-15,'j'),'j')from dual;,select to_char(to_date(cast('1' as char) ,'j' ),'j') from dual;,  
|  
|  
|
|  
|格式符| 'J'  , 'JSP',1.大小写:输出小写：j，jsp，jSP,                   输出大写：J,   JSP, JSp,            首字母为大写：Jsp,JsP,  
,,2.多个j/jsp:jj,jspjsp,jsp-j,jjsp, 目前最大输出varchar 8k,select to_char(date'2012-11-01','jj') from dual;,select to_char(date'2012-11-01','jspjsp') from dual;,select to_char(date'2012-11-01','jsp-j') from dual;,select to_char(date'2012-11-01','jjsp') from dual;,  
,  
,  
,  
|sp,J-sp,select to_char(to_date(0001),'j-sp') from dual;,select to_char(to_date(0001),'sp') from dual;,格式符不使用引号：,select to_char(to_date(0001),j)from dual;,  
|  
|
|  
|j/jsp与format组合,  
,  
,  
|J/JSP与format大小写组合,select to_char(date'2012-11-01','j-YYyy') from dual;,select to_char(date'2012-11-01','jSP-YYyy') from dual;,select to_char(date'2012-11-01','jSP-YY-jyyyyyyy') from dual;,  
,j与yyyy-mm-dd hh-mi-ss：,select to_char(date'2012-11-01','j-yyyy-mm-dd hh-mi-ss') from dual;,  
,format在j前面：,select to_char(to_date(0001),'yyyy-j') from dual;,  
,单个格式符混合fmt：,select to_char(to_date('17214240001', 'jyyyy'),'jyyyy') from dual;,select to_char(to_date('172142401', 'jmm'),'jss') from dual;,单个格式符混合fmt且to_date中不含格式符j,select to_char(to_date(0001,'yyyy'),'j')from dual;,select to_char(to_date(1452-11-03,'yyyy-mm-dd'),'j-yyyy')from dual;,  
,多个格式符混合fmt：,select to_char(to_date(14521103,'yyyy mm-dd'),'j-yyyy/jsp')from dual;,select to_char(to_date('0001-1721424', 'yyyy-j'),'jspyyyy-j_mm_/_jsp') from dual;,select to_char(to_date('0001-1721424', 'yyyy-j'),'jspyyyy-j_mm_d_jsp') from dual;|to_date成功，to_char与fmt组合异常,  
,  
,  
|  
|
|  
|plsql| 绑定参数/json格式绑定参数|  
|  
|
|  
|位置|在投影列,在where，having，group by ,order by,在子查询，集合，join,distinct,select to_char(c1,'j')from test_sdv_to_char_fmt_d_1 where to_char(c1,'j')>10;,函数并列：,select to_date(1,'j'),to_date(1,'j') from dual;,select to_date(1,'j'),to_char(to_date(1,'j'),'j') from dual;,  
|  
|  
|
|  
|  
|typeof|  
|  
|
|  
|视图|view/materialized view|  
|  
|
|  
|  
|crate table as select...,insert into select,update..where a in,delete... where a in,update..where a in(select to_char(c1,'j')from dual where to_char(c1,'j')>10;),  
|  
|  
|
|  
|表类型行存|heap|  
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
|性能|否|
|长稳|否|


  


  


|dfx测试设计|  
|
|:---|:---|
|ct/kt|dql/dql之间并发|
|  
|  
|
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
|部署|单机、集群|


  


# 7. 工作量评估

工作量：  *1人天*

计划测试完成时间：

  


## Attachments:

[to_date,to_char儒略日文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYzNhMWFkOWEzMzExZGM4NTQ0IiwicmVmX2lkIjoiNjczOTZiYzM3MjgyMDZlZmI5MmYwOWZjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2ODk2LCJleHAiOjE3ODIzODMyOTZ9.wWi85Mj08Z54R5DnOW3MYuGIi8xeVUukWlKqfv2HOp0)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
