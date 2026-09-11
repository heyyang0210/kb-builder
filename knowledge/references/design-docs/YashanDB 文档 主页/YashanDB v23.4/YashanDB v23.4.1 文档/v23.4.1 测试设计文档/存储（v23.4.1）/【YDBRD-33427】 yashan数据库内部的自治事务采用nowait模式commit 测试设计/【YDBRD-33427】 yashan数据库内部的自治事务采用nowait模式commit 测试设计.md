Created by 郑荃, last modified on 十月 30, 2024

SR链接

  [https://pingcode.yasdb.com/pjm/items/6704a0ade489dd0868f189e8?](https://pingcode.yasdb.com/pjm/items/6704a0ade489dd0868f189e8?)  

#YDBRD-33427 yashan数据库内部的自治事务采用nowait模式commit

# 1. 概述

yashan数据库内部的自治事务采用nowait模式commit，提升insert into select场景的IO性能

# 2. 需求分析

## 2.1 功能点分析

x86架构oracle/yashan，arm架构oracle/yashan，insert into select性能对比数据如下（x86/arm环境只有cpu不同，其他内存，硬盘一样）：

测试SQL：insert into bal_income_tmp_008 select * from bal_income_tmp_008_src;

用例特点：目标表存在七个列的主键索引，及其余三个1列/2列的索引；

测试结果：

x86 oracle，开并行3s，不开并行6s；

x86 yashan，不到12s；



arm oracle，开并行6s，不开并行10s；

arm yashan，37s；

## 2.2 应用场景

insert into select 场景下性能提升

## 2.3 规格约束

无

# 3. 详细测试设计

## 3.1 测试设计方法

主要采用场景法，对insert into select的性能进行验证

## 3.2 详细测试设计

问题单场景如下：

```
CREATE TABLE "BAL_INCOME_TMP_008_SRC"
("TANO" VARCHAR(18) NOT NULL ENABLE,
"INCOMEDATE" VARCHAR(8) NOT NULL ENABLE,
"TAACCOUNTID" VARCHAR(12) NOT NULL ENABLE,
"DISTRIBUTORCODE" VARCHAR(9) NOT NULL ENABLE,
"BRANCHCODE" VARCHAR(9),
"TRANSACTIONACCOUNTID" VARCHAR(17) NOT NULL ENABLE,
"INVESTORNAME" VARCHAR(240),
"CERTIFICATETYPE" VARCHAR(3),
"CERTIFICATENO" VARCHAR(40),
"CLEARACCT" VARCHAR(40),
"TRANSACTIONCFM" VARCHAR(8),
"INVTP" CHAR(1),
"FUNDCODE" VARCHAR(32) NOT NULL ENABLE,
"SHARETYPE" CHAR(1) NOT NULL ENABLE,
"MANAGERCODE" VARCHAR(18),
"B1" NUMBER DEFAULT 0,
"B2" NUMBER DEFAULT 0,
"B3" NUMBER DEFAULT 0,
"UNF1" NUMBER DEFAULT 0,
"UNF2" NUMBER DEFAULT 0,
"DISPERSION" NUMBER DEFAULT 0,
"F1" NUMBER DEFAULT 0,
"F2" NUMBER DEFAULT 0,
"ISNEXT" CHAR(1)
) PCTFREE 8 INITRANS 2 MAXTRANS 255
LOGGING
TABLESPACE "USERS"
SEGMENT CREATION DEFERRED
ORGANIZATION HEAP;


create table BAL_INCOME_TMP_008 as select * from BAL_INCOME_TMP_008_SRC;


CREATE INDEX "I_TMP_1" ON "BAL_INCOME_TMP_008"
("FUNDCODE" , "INCOMEDATE" 
)
PCTFREE 8 INITRANS 2 MAXTRANS 255
TABLESPACE "USERS";


CREATE INDEX "I_TMP_2" ON "BAL_INCOME_TMP_008"
("TAACCOUNTID" , "FUNDCODE" 
)
PCTFREE 8 INITRANS 2 MAXTRANS 255
TABLESPACE "USERS";


CREATE INDEX "I_TMP_3" ON "BAL_INCOME_TMP_008"
("TRANSACTIONCFM" 
)
PCTFREE 8 INITRANS 2 MAXTRANS 255
TABLESPACE "USERS";


CREATE UNIQUE INDEX "I_TMP_4" ON "BAL_INCOME_TMP_008"
("TAACCOUNTID" , "TRANSACTIONACCOUNTID" , "DISTRIBUTORCODE" , "FUNDCODE" , "SHARETYPE" , "INCOMEDATE" , "TANO" 
)
PCTFREE 8 INITRANS 2 MAXTRANS 255
TABLESPACE "USERS";
begin
    for i in 1 .. 1000000 loop   
    insert into BAL_INCOME_TMP_008_SRC(tano, INCOMEDATE, TAACCOUNTID, DISTRIBUTORCODE, TRANSACTIONACCOUNTID, TRANSACTIONCFM, FUNDCODE, SHARETYPE) values('ZJTA','20240908', concat(i%100000, ''), concat(i%1000, ''), concat(i, ''), concat(i%100000, ''), concat(i%100000, ''), 'N');
    end loop;
end;


truncate table bal_income_tmp_008;


insert into bal_income_tmp_008 select * from bal_income_tmp_008_src;
commit;

```

|场景|预期|备注|
|---|---|---|
|问题单场景，带索引和外键场景下，单线程执行insert into select ，性能跟历史版本和oracle对比|跟oracle持平，和历史版本对比性能有提升||
|不带外键和索引场景下，单线程执行insert into select |和历史版本对比性能有提升||
|不同表并发INSERT INTO SELECT性能|和历史版本对比性能有提升||
||||


DFX覆盖说明：

|系统级DFX分类|是否涉及|
|---|---|
|CT|涉及|
|KT|不涉及|
|长稳|不涉及|
|一致性|不涉及|
|三方测试工具    
  (sqltest，sqlancer)|不涉及|
|安全|不涉及|
|DFR|不涉及|
|HA|不涉及|
|压力|不涉及|
|性能|涉及|
|可维护性|不涉及|


  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


详见附件

# 5. 测试框架设计

- *如果用例不能实现自动化需要在此标注并说明原因*
- *确认使用的测试框架及其满足度*


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

# 7. 工作量评估

工作量：  *xx人天*

计划测试完成时间：

  [详细测试设计文档模板.doc](#)  