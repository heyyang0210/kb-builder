*IR链接：*  [YASHAN-3122](https://pingcode.yasdb.com/ship/ideas/66c5b23b4283cf23d4f37342?)  

*SR链接：*  [YDBRD-34239](https://pingcode.yasdb.com/pjm/items/670e3846e489dd0868f7e06b?)  

##   [1. 总述](#1-总述)  

###   [1.1 需求来源](#11-需求来源)  

支持MySQL中CURRENT_TIMESTAMP、LOCALTIME、LOCALTIMESTAMP、NOW、SYSDATE、UTC_TIMESTAMP函数。

###   [1.2 调研文档](#12-调研文档)  

  [特性调研-YDBRD-34239：支持MySQL同名datetime相关函数](https://pingcode.yasdb.com/wiki/spaces/WANGBOWEN/pages/676512ced2baff0fd55e0e78)  

###   [1.3 需求分析](#13-需求分析)  

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|---|---|---|---|---|
|功能|NOW([fsp]),SYSDATE([fsp]),UTC_TIMESTAMP([fsp]),UTC_TIMESTAMP|见特性设计|是|是|


###   [1.4 数据字典](#14-数据字典)  

###   [1.5 开源依赖](#15-开源依赖)  

##   [2. 接口](#2-接口)  

```
select NOW([fsp]);
select SYSDATE([fsp]);
select UTC_TIMESTAMP([fsp]);

```

##   [3. 规格与约束](#3-规格与约束)  

##   [4. 特性](#4-特性)  

###   [4.1 特性功能点1 支持datetime函数](#41-特性功能点1-duration---number---double)  

|函数|描述|
|---|---|
|now()|直接取值stmt. execStart，该成员在anlResetStat中被赋值为utc时间；,参数经校验后赋给func. desc，用于确保mysql客户端小数长度；在yasql中仅作截断，其后为0|
|sysdate()|调用codSysdate()，参数同now()|
|utc_timestamp()|同now()|
|utc_timestamp,current_timestamp|tokenType为SYSVAR，作为操作符时增加compatExecSysvarExpr|
|其余同义词函数、操作符|同now()|


###   [4.2 特性功能点2 屏蔽now、sysdate操作符](#41-特性功能点1-duration---number---double)  

- now为default word，被解析为内置函数，在verifyBif中根据名称获得，则报错；
- sysdate为sysvar word，添加compatVerifySysVarTimeGroup函数进行检验；
- 如何在read后区分now()、now？ExprNode. args均为NULL


###   [4.3 特性功能点3 兼容模式下datetime类型四则运算](#41-特性功能点1-duration---number---double)  

- 返回值类型为bigint、double、number


##   [5. Testcases（自测用例）](#5-testcases自测用例)  

```

select now(6) - current_timestamp(6), now(6) - localtime(6), now(6) - localtimestamp(6), now(6) - utc_timestamp(6),
       sleep(0.01),
       now(6) - current_timestamp(6), now(6) - localtime(6), now(6) - localtimestamp(6), now(6) - utc_timestamp(6);

select sysdate(6) > now(6);

select now(6), sysdate(6), utc_timestamp(6), sleep(0.01), now(6), sysdate(6), utc_timestamp(6);

select sysdate(6), sleep(0.01), now(6), sysdate(6), utc_timestamp(6);

```

自测关注点：

1. 覆盖全面
1. 避免重复测试
1. 测试用例的可维护性


自测用例设计方法：

1. 边界值
1. 等价类
1. 正交


##   [6.资料设计章节](#6资料设计章节)  

新增文档 doc/产品文档/开发手册/MySQL兼容模式参考手册/内置函数/DATETIMEXXX.md

##   [7.未来规划](#7未来规划)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。  
