Created by 张欣, last modified on 十一月 15, 2024

# 1. 概述

  [https://pingcode.yasdb.com/pjm/items/6732c20be489dd086808098e](https://pingcode.yasdb.com/pjm/items/6732c20be489dd086808098e)    ?    
  #YDBRD-35228 INDEX-BY表的变量的存取访问性能优化

需求来源：

国信证券-融选POC性能识别    
       
  场 景：    
  1、INDEX-BY表（关联数组）的变量的存取访问性能优化，当前验收用例是O的60多倍

# 2. 需求分析

## 2.1 功能点分析

- 主要是性能场景：


insert：新增key-value

查找（取成员）：根据key值访问value     key值有序，无序（字符串拼接内容）；全部查找，first -last ; 部分查找 按值，index of, values of

修改 value值：根据key值修改value

copy：整个变量copy；成员是index by数组，copy成员

- 功能场景：index by数组原有的功能，赋值、存取顺序正确性；各类方法结果的正确性。


主要由已有功能用例覆盖；在之前的基础上再分析是否有需要补充的场景。

index-by类型：local，pkg.local

数组key类型：int，varchar； expr: 算术表达式（int）,字符串表达式（拼接，内置函数），udf

数组value类型：标量类型：varchar，number，date； 大对象； UDT类型：object，varray，nested table, index by table 

## 2.2 应用场景

基础场景：

1.融选的index by场景：

```
declare
  type Rec_Bond is record(
    fl_securityid  number(12),
    fc_securitycode  varchar2(40),
    fc_chinesename  varchar2(128),
    fc_securitymarket  varchar2(4),
    fl_securitytypes  number(2),
    fc_isin  varchar2(32),
    fl_securitytypeextone  number(2),
    fc_currency  varchar2(3),
    ff_facevalue  number(19,4),
    ff_issueprice  number(19,4),
    fd_valuedate  date,
    fd_duedate  date,
    fl_netorfull  number(4),
    fl_ratetype  number(4),
    fl_intpaymeth  number(4),
    fl_cappaymeth  number(4),
    fl_intcalmeth  number(4),
    fl_intcalmethdue  number(4),
    fd_firstpaydate  date,
    fl_right  number(4),
    fl_clearhouse  number(4),
    ff_taxrate  number(19,4),
    fd_rightdate  date,
    fd_modifieddate  date,
    fl_modifier  number(12),
    fd_auditdate  date,
    fl_auditor  number(12),
    ff_interestrate  number(15,12),
    ff_exchrate_gd  number(18,12),
    fl_issuertype  number(4),
    fd_convertbegindate  date,
    fd_convertenddate  date,
    fl_guarantee  number(1),
    fl_issuerid  number(12),
    fl_guaranteeid  number(12),
    ff_callprice  number(19,4),
    fc_issueperiod  varchar2(20),
    fd_issuebegindate  date,
    fd_issueenddate  date,
    ff_totalbondissue  number(19,4),
    fl_intcalmode  number(1),
    fl_intcalmodedue  number(1),
    fl_originalownerid  number(12),
    fl_priorityflag  number(1),
    fl_perpetualflag  number(1),
    fl_automation  number(1),
    fl_accountingclass number(1) := 2,
    fl_issuemode number(1),
    fl_securityid_ib number(12),
    fc_industryno varchar2(3),
    fc_industryno_capco varchar2(3),
    fl_flag               number(1)
  );

  type Tab_bond is table of Rec_bond;
  type Tab_BondWithKey is table of number(12) index by varchar2(128);
  
  vTab_Bond Tab_bond := Tab_bond();
  vTab_BondIdxByMktIsin Tab_BondWithKey;
  vTab_BondIdxById Tab_BondWithKey;
  vc_key                     varchar2(100);
begin
  select fl_securityid, fc_securitycode, fc_chinesename, fc_securitymarket, fl_securitytypes, fc_isin, fl_securitytypeextone, fc_currency,
         ff_facevalue, ff_issueprice, fd_valuedate, fd_duedate, fl_netorfull, fl_ratetype, fl_intpaymeth, fl_cappaymeth, fl_intcalmeth,
         fl_intcalmethdue, fd_firstpaydate, fl_right, fl_clearhouse, ff_taxrate, fd_rightdate, sysdate, 0, fd_auditdate,
         fl_auditor, ff_interestrate, ff_exchrate_gd, fl_issuertype, fd_convertbegindate, fd_convertenddate, fl_guarantee, fl_issuerid,
         fl_guaranteeid, ff_callprice, fc_issueperiod, fd_issuebegindate, fd_issueenddate, ff_totalbondissue, fl_intcalmode, fl_intcalmodedue,
         fl_originalownerid, fl_priorityflag, fl_perpetualflag, fl_automation, fl_accountingclass, fl_issuemode, fl_securityid_ib, fc_industryno,
         fc_industryno_capco, 0 fl_flag
    bulk collect into vTab_Bond
    from "LSFADEV_XN".tc_secbond;
    
  if vTab_Bond.count > 0 then
    for i in vTab_Bond.first..vTab_Bond.last loop
      vc_key := vTab_Bond(i).fc_isin||'_'||vTab_Bond(i).fc_securitymarket||'_'||vTab_Bond(i).fl_securitytypes;
      vTab_BondIdxByMktIsin(vc_key) := i;

      vc_key := vTab_Bond(i).fl_securityid;
      vTab_BondIdxById(vc_key) := i;
    end loop;
  end if;
end;
/
```

2.基础场景

insert为例

index by varchar

```
declare
type type1 is table of number(12) index by varchar(200);
table1 type1;
begin
  for i in 1  .. 1000000 loop
    table1(i) := i;
  end loop;
end;
/
```

Oracle 长度每增加10倍，性能成倍增长；yashan劣化较严重。

index by integer

```
declare
type type1 is table of number(12) index by pls_integer;
table1 type1;
begin
  for i in 1  .. 2113663 loop
    table1(i) := i;
  end loop;
end;
/
```

  


yashan版本：YashanDB Server Enterprise Edition Release 23.4.0.1 x86_64 960de82c97

  


|  
|  
|循环次数（关联数组长度）|Oracle|yashan(优化前)|  
|
|---|---|---|---|---|---|
|insert|||||  
|
|index by varchar    
    
    
|local|100000|Elapsed: 00:00:00.07|Elapsed: 00:00:05.590|  
|
|||1000000|Elapsed: 00:00:00.63|Elapsed: 00:10:09.650|  
|
|||10000000|Elapsed: 00:00:06.52|Elapsed: 04:07:25.957|  
|
|index by int|local|100000|Elapsed: 00:00:00.02|Elapsed: 00:00:00.068|  
|
|||1000000|Elapsed: 00:00:00.22|Elapsed: 00:00:00.802|  
|
|||2113663|Elapsed: 00:00:00.37|Elapsed: 00:00:01.552|  
|
|查找 访问|||||  
|
|index by varchar    
    
    
|local|100000|Elapsed: 00:00:00.11-Elapsed: 00:00:00.07|Elapsed: 00:00:05.813-Elapsed: 00:00:05.590|  
|
|||1000000|Elapsed: 00:00:00.92-Elapsed: 00:00:00.63|Elapsed: 00:10:11.181-Elapsed: 00:10:09.650 |  
|
||pkg|100000|Elapsed: 00:00:00.03|Elapsed: 00:00:00.097|  
|
|||1000000|Elapsed: 00:00:00.35|Elapsed: 00:00:01.058|  
|
|index by int    
    
    
|local|100000|  
|  
|  
|
|||2113663|  
|  
|  
|
||pkg|100000|Elapsed: 00:00:00.01|Elapsed: 00:00:00.090|  
|
|||2113663|Elapsed: 00:00:00.09|Elapsed: 00:00:01.461|  
|
||forall index of|100000|Elapsed: 00:00:00.12|Elapsed: 00:00:01.102 ||
|||2113663|Elapsed: 00:00:00.95|Elapsed: 00:00:19.256||
||forall values of|100000|Elapsed: 00:00:00.05|Elapsed: 00:00:01.199||
|||2113663|Elapsed: 00:00:00.73|Elapsed: 00:00:19.814||
|修改 value值||||||
|index by varchar|pkg|100000|Elapsed: 00:00:00.06|Elapsed: 00:00:00.208|  
|
|||1000000|Elapsed: 00:00:00.55|Elapsed: 00:00:01.815|  
|
|index by int|pkg|100000|Elapsed: 00:00:00.06|Elapsed: 00:00:00.169|  
|
|||2113663|Elapsed: 00:00:00.22|Elapsed: 00:00:02.451|  
|
|copy 关联数组变量整个copy 1000次||||||
|index by varchar|pkg|100000|Elapsed: 00:00:05.57|Elapsed: 00:00:27.180|  
|
|  
|  
|1000000|Elapsed: 00:00:58.87|Elapsed: 00:04:43.658|  
|
|index by int|pkg|100000|Elapsed: 00:00:01.10|Elapsed: 00:00:20.740|  
|
|  
|  
|2113663|Elapsed: 00:00:36.04|Elapsed: 00:07:42.534|  
|


扩展场景：

## 2.3 规格约束

1.调整后index by int 上限不再是2113663，重新验证；

2.调整后index by table变量整体不再支持比较，同Oracle；资料补充。

# 3. 详细测试设计

## 3.1 测试设计方法

性能场景测试主要采用场景分析法，结合外场的使用场景及index by数组的主要场景及扩展场景性能。

## 3.2 详细测试设计

1. *使用章节3.1的测试方法设计详细的功能测试点，可借用xmind的方式*


性能场景：

基础场景：

|  
|关联数组长度|insert|查找|修改|copy|
|---|---|---|---|---|---|
|1.融选场景|14w|  
|  
|  
|  
|
|2.index by varchar|100000,1000000,10000000|  
|  
|  
|  
|
|3.index by int|100000,2113663(上限)|  
|  
|  
|  
|


扩展场景：

|场景大类 |key值类型|key值有序/无序|value成员类型|查找范围|查找方式|
|---|---|---|---|---|---|
|insert|算术表达式（int）,,字符串表达式（拼接，内置函数），,udf|补充：,1.key值重复值占比：不重复；中间值重复（重复key其实走修改流程）；极端重复（多次修改value）  
2.非重复值的数据分布：,index by int-随机、均匀、泊松;,index by varchar-随机、均匀、泊松;|标量类型：varchar(100,32000)，nchar(),varchar(n char),number，date； ,大对象：lob,json； ,UDT类型：record/object，varray，nested table, index by table (  下面补充类型说明  ),目前看成员类型 即使是复合类型，对性能影响不明显。（测试结果会出具体数据）|  
|  
|
|查找： 基础访问；,方法：多次next,  prior;,delete后exists，next,prior等||有序，,无序（复杂字符串 特殊字符 不同字符集排序）|  
|全部查找,部分查找|index of, ,values of|
|修改：根据key值修改value;||√|  
|  
|  
|
|copy：整个变量copy；,copy成员|  
|  
√,key值是长的（1-32000）复杂字符串|  
,成员是  index by table |  
|  
|


index by成员是UDT  类型说明

|value成员类型||
|---|---|
|record|```
  type Rec_Bond_1 is record(
    fl_securityid NUMBER(12,0),
    fc_securitycode VARCHAR2(40),
    fc_chinesename VARCHAR2(128),
    fd_valuedate DATE,
    ff_interestrate NUMBER(15,12)
  );
  type Tab_BondWithKey is table of Rec_Bond_1 index by varchar2(128);
```|
|object|```
create type Obj_YDBRD_35228_50 is object(
    fl_securityid NUMBER(12,0),
    fc_securitycode VARCHAR2(40),
    fc_chinesename VARCHAR2(128),
    fd_valuedate DATE,
    ff_interestrate NUMBER(15,12)
  );
  /
type Tab_BondWithKey is table of Obj_YDBRD_35228_50 index by varchar2(128);
```|
|varray|```
type varray_Bond_1 is varray(2000) of varchar(32000);
type Tab_BondWithKey is table of varray_Bond_1 index by varchar2(128);
```|
|嵌套表|```
create type Tab_Bond_YDBRD_35228_50 as table of varchar(32000);
type Tab_BondWithKey is table of Tab_Bond_YDBRD_35228_50 index by varchar2(128);
vTab_BondIdxByMktIsin Tab_BondWithKey;
vTab_BondIdxByMktIsin(v_cur.fc_isin||'_'||v_cur.fc_securitymarket||'_'||v_cur.fl_securitytypes) := Tab_Bond_YDBRD_35228_50(v_cur.fl_securityid,v_cur.fc_securitycode,v_cur.fc_chinesename,v_cur.fd_valuedate,v_cur.ff_interestrate);
```|
|index by table|```
  type Tab_BondWithKey is table of number(12) index by varchar2(128);
  type Tab_Bond_IndexBy_WithKey is table of Tab_BondWithKey index by varchar2(128);
```|




功能：

涉及不多。

1.主要是审视历史index by用例的覆盖情况，方法使用，数组访问结果的正确性。

补充：2.对比优化前后app pool的消耗情况，目前已知每个成员占用增加16字节。    


1. *梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*


|系统级DFX分类|是否涉及|
|---|---|
|CT|是 检查历史index by CT用例的覆盖情况，视情况补充。关注app pool的释放。  
|
|KT|是   
|
|长稳|  
|
|一致性|  
|
|三方测试工具    
  (sqltest，sqlancer)|  
|
|安全|  
|
|DFR|  
|
|HA|  
|
|压力|  
|
|性能|是  
|
|可维护性|  
|


  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


详见附件

  [index_by优化性能数据.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjc0NTM4ZWI4OTcwYzJhZjRmNTNiODVmIiwicmVmX2lkIjoiNjczOWM3NDY3MjgyMDZlZmI5MzEzOGQ0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU3NDc2LCJleHAiOjE3ODI1NDM4NzZ9.XcIYGWbnwnBClQHMnaHV7MsFqXGyehPjIY4tuQvgweM)  

# 5. 测试框架设计

- *如果用例不能实现自动化需要在此标注并说明原因*
- *确认使用的测试框架及其满足度*


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

# 7. 工作量评估

工作量：  *xx人天*

计划测试完成时间：

[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOWM3NDZhMWFkOWEzMzExZGUwMTJiIiwicmVmX2lkIjoiNjczOWM3NDY3MjgyMDZlZmI5MzEzOGQ0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU3NDc2LCJleHAiOjE3ODI1NDM4NzZ9.jXtsfM4KwTySF05PIaaGSnTFotv3dclNH1FTvCMg7sI)

## Attachments:

[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOWM3NDZhMWFkOWEzMzExZGUwMTJiIiwicmVmX2lkIjoiNjczOWM3NDY3MjgyMDZlZmI5MzEzOGQ0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU3NDc2LCJleHAiOjE3ODI1NDM4NzZ9.jXtsfM4KwTySF05PIaaGSnTFotv3dclNH1FTvCMg7sI)

 (application/msword)    


[XXX功能测试设计.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOWM3NDZhMWFkOWEzMzExZGUwMTJjIiwicmVmX2lkIjoiNjczOWM3NDY3MjgyMDZlZmI5MzEzOGQ0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU3NDc2LCJleHAiOjE3ODI1NDM4NzZ9.EBV92qJrvaw2-VtHBtaB-NrzKq2ITDBoi1ZJS7MEGCM)

 (application/msword)    
