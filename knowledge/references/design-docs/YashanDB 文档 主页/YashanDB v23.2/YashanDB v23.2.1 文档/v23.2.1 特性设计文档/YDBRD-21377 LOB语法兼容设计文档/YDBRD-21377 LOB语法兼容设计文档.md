Created by 张志鹏, last modified on 二月 27, 2024

  


#   [YDBRD-21377 LOB语法兼容](#ydbrd-21377-lob语法兼容)  

IR链接：YDBRD-XXXX / SR链接：    [https://jira.yasdb.com/browse/YDBRD-21377](https://jira.yasdb.com/browse/YDBRD-21377)  

##   [1. Overview（概述）](#1-overview概述)  

ORACLE的DDL语法LOB STORE AS SECUREFILE语法兼容    
  原始需求场景：ORACLE通过dbms_metadata.get_ddl导出DDL时，会附带一些默认配置DDL，在崖山上需要做语法兼容目的：导出的DDL在崖山执行不报错，崖山功能暂无影响。

##   [2. Features（功能特性）](#2-features功能特性)  

1、KEEP_DUPLICATES    
  2、CHUNK integer    
  3、NOCACHE    
  4、LOGGING    
  5、NOCOMPRESS    
  sql示例：    
  LOB ("C1") STORE AS SECUREFILE (    
  TABLESPACE "PRDADM" ENABLE STORAGE IN ROW CHUNK 8192    
  NOCACHE LOGGING NOCOMPRESS KEEP_DUPLICATES )

**支持lob store as securefile ("lob_paramets")**  lob_parameters见3.2

##   [3. Interfaces（接口）](#3-interfaces接口)  

略  **1.函数或者表达式特性，要从测试用户或者DBA角度，给出对外接口。**

**2.SQL语法，必须给出EBNF。禁止描述不存在的分支。**    
  syntax::= LOB "("(column) {"," (column)} ")" STORE AS [BASICFILE|SECUREFILE]    
  "("    
  (    
  TABLESPACE space_name    
  |(ENABLE|DISABLE) STORAGE IN ROW    
  **| CHUNK integer**    
  **| {CACHE |  NOCACHE | CACHE READS } |{LOGING | NOLOGING}**    
  **| {(COMPRESS (LOW|MEDIUM|HIGH))|NOCOMPRESS}**    
  **| {DEDUPLICATE|KEEP_DUPLICATES}**    
  )    
  ")"

**3.协议、驱动等接口类，必须罗列完全用户可感知的接口函数说明。**

**4.与数据库的功能相关的系统表、系统视图和配置参数**

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

1. 本需求适配lob参数chunk interger  interger的范围是(0,32K], 2, 32768, 1k, 32K （调研实测oracle19c得出）
1. hash分区不能带本需求适配的五个lob_parameters clause.  （oracle实测结论）
1. 二级分区可以指定lob store as(tablespace ts)
1. 分区支持lob(column) store as (lob_parameters)语法兼容。alter table add partition 带lob_parameters clause, 不校验column是否存在（需要到存储层校验，未支持分区lob带配置，语法兼容不涉及），也不生效。分区lob_parameters中tablespace也不校验是否存在（同上原因）。


```
create table rl_composite(a int, b int, c clob, d clob)
  LOB(c) STORE AS SECUREFILE (
  TABLESPACE "PRDADM" ENABLE STORAGE IN ROW 
  CHUNK 8192
  NOCACHE 
  LOGGING 
  NOCOMPRESS 
  KEEP_DUPLICATES
)

partition by range(a)
subpartition by list(b) 
(
	partition p1 values less than(10) lob(d) STORE AS SECUREFILE ( KEEP_DUPLICATES )
	(
		subpartition sp1 values(10),
		subpartition sp2 values(20),
        subpartition sp3 values(default)
	),
	partition p2 values less than(20)
	(
		subpartition sp4 values (10),
		subpartition sp5 values (20)
	),
	partition p3 values less than(40)
	(
		subpartition sp6 values (10),
		subpartition sp7 values (20)
	)
);




```

##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

仅语法兼容，略。

###   [5.1 Architecture（架构）](#51-architecture架构)  

略

###   [5.2 Data Structures & Flow（数据结构与流程）](#52-data-structures--flow数据结构与流程)  

略

###   [5.3 Compatibility（兼容性）](#53-compatibility兼容性)  

略

**在涉及对已交付版本的系统表、系统视图、系统包等特性做修改时，要参照版本兼容性要求文档，给出兼容性设计。**

###   [5.4 DFX设计](#54-dfx设计)  

略

###   [5.5 其他](#55-其他)  

略

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

设计开发人员自测用例（文字描述），给出开发者自测试的设计方案表格或者XMIND、开发自测的用例归档路径。

```
drop table hh_composite;
create table hh_composite(a int, b varchar(10), c clob)
    partition by hash(a)
subpartition by hash(b)
(partition p1  tablespace users lob(c) store as (cache) (subpartition subp1));

报错ORA-22877: invalid option specified for a HASH partition or subpartition of a


```

##   [7.资料设计章节](#7资料设计章节)  

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

*说明本方案遗留的问题或下一步需要解决的问题。*