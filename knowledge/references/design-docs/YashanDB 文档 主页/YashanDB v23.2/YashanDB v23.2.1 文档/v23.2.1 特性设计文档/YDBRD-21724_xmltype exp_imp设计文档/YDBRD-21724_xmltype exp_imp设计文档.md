Created by 袁昊坤, last modified on 十月 14, 2024

#   [YDBRD-21724: xmltype](https://conf.yasdb.com/pages/viewpage.action?pageId=91777359#ydbrd-xxxx-xxx-researchxxx-%E7%89%B9%E6%80%A7%E8%B0%83%E7%A0%94)      [exp/impDesign](https://conf.yasdb.com/pages/viewpage.action?pageId=91777359#ydbrd-xxxx-xxx-researchxxx-%E7%89%B9%E6%80%A7%E8%B0%83%E7%A0%94)      [(xmltype](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#ydbrd-xxxx--xxx-designxxx%E6%96%B9%E6%A1%88%E8%AE%BE%E8%AE%A1)      [exp/imp](https://conf.yasdb.com/pages/viewpage.action?pageId=91777359#ydbrd-xxxx-xxx-researchxxx-%E7%89%B9%E6%80%A7%E8%B0%83%E7%A0%94)      [方案设计](https://conf.yasdb.com/pages/viewpage.action?pageId=91777359#ydbrd-xxxx-xxx-researchxxx-%E7%89%B9%E6%80%A7%E8%B0%83%E7%A0%94)      [）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#ydbrd-xxxx--xxx-designxxx%E6%96%B9%E6%A1%88%E8%AE%BE%E8%AE%A1)  

SR链接：    [YDBRD-21724](https://jira.yasdb.com/browse/YDBRD-21724?src=confmacro)    -  exp/imp支持xmltype数据类型  完成

MR链接：    [feat:YDBRD-18928 增加XMLTYPE数据类型，允许建表和存取使用 (!24484) · Merge requests · CoD-X / AnchorBase · GitLab (yasdb.com)](https://git.yasdb.com/cod-x/anchorbase/-/merge_requests/24484)  

##   [1. Overview（概述）](#1-overview概述)  

SR描述：exp/imp支持xmltype数据类型。

规格范围：单机, 集群

##   [2. Features（功能特性）](#2-features功能特性)  

支持XMLTYPE列数据的导入导出；XMLTYPE列存储属性导入导出。

###   [2.1 规格说明](#21-规格说明)  

- 支持全库导入导出。
- 支持user导入导出。
- 支持table导入导出。
- 支持csv两种模式，lls和非lls的导出。


##   [3. Interfaces（接口）](#3-interfaces接口)  

列出本方案对外提供的接口、配置参数、API等。

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

###   [4.1 导出规则：](#41-导出规则)  

与clob规则一致

- 长度存储：变长存储其长度，小于（CodUint32）FFFFFFF2（4294967282 B），直接存长度；否则长度为：FFFFFFF2+CodUint64。


即当长度小于（CodUint32）FFFFFFF2时，直接存储长度，长度后为该长度的数据。否则，识别到FFFFFFF2，表示长度为FFFFFFF2+CodUint64。

- 元数据列属性位置：表的tablespace和分区属性之间。
- lob列属性位置：无需完全按照表的列顺序定义其属性。
- 创建语句中多列公用lob存储属性，导出时，单列逐个导出。


###   [4.2 导入规则：](#42-导入规则)  

与clob规则一致

- 列长度：首先识别为lob列，读取


##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

主要参考clob导入导出设计。

导出：

在exp_impl.c中添加xmltype的判断逻辑，使其走CLOB相同分支。

导入：

在imp_impl.c中添加xmltype的判断逻辑，使其走CLOB相同分支。

###   [5.1 Architecture（架构）](#51-architecture架构)  

说明方案的总体架构，优先考虑通过架构图进行描述。给出业务架构和对应的技术架构。

###   [5.2 Data Structures & Flow（数据结构与流程）](#52-data-structures--flow数据结构与流程)  

导入导出的存储方式与lob存储方式相同。

- 长度存储：变长存储其长度，小于（CodUint32）FFFFFFF2（4294967282 B），直接存长度；否则长度为：FFFFFFF2+CodUint64。


即当长度小于（CodUint32）FFFFFFF2时，直接存储长度，长度后为该长度的数据。否则，识别到FFFFFFF2，表示长度为FFFFFFF2+CodUint64。

  [https://conf.yasdb.com/pages/viewpage.action?pageId=127654167](https://conf.yasdb.com/pages/viewpage.action?pageId=127654167)  

###   [5.3 Compatibility（兼容性）](#53-compatibility兼容性)  

说明设计方案对兼容性的影响，如果影响了兼容性，则需要给出详细的兼容性方案设计。

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

测试点：

- 元数据，指定表空间属性，导入导出后表空间属性是否一致
- 特殊符合以及中文情况。
- 底层是以lob实现，在大数据的情况下是否符合预期，与lob一致。


|导出|导入|预期|
|:---|:---|:---|
|full|full|导入所有用户的所有表|
||user|仅导入指定user的表/表数据|
||table|仅导入指定table的表数据|
|user    
    
|full|仅导入指定用户的所有表|
||user|仅导入指定user的表/表数据|
||table|仅导入指定table的表数据|
|table|table|仅导入指定table的表数据|


例如：

```
drop table if exists xmltype_test;
create table xmltype_test(co1 xmltype, co2 clob);
insert into xmltype_test values('&lt;employee&gt;&lt;id&gt;1&lt;/id&gt;&lt;name&gt;John&lt;/name&gt;&lt;/employee&gt;', '&lt;employee&gt;&lt;id&gt;1&lt;/id&gt;&lt;name&gt;John&lt;/name&gt;&lt;/employee&gt;');
select DBMS_LOB.COMPARE(co1, co1) from xmltype_test;
select DBMS_LOB.COMPARE(co2, co2) from xmltype_test;
select  DBMS_LOB.GETLENGTH(co1) from xmltype_test;
select  DBMS_LOB.GETLENGTH(co2) from xmltype_test;
 
 
 
--模式：全库/user/table导出，全库/user/table导出
--导出：全库
exp user1/1@192.168.7.109:1688 file=a full=y
--导出：user
exp user1/1@192.168.7.109:1688 file=a owner=user1,user2
--导出：table
exp user1/1@192.168.7.109:1688 file=a tables=user1.test_lob1,user2.test_lob1
例如：将regress用户的xmltype_test表导出到桌面的test.txt文件中。
./exp regress/regress@127.0.0.1:1688 file=/mnt/c/Users/yuanhaokun/Desktop/test.txt tables=xmltype_test
 
--导入：全库
imp sys/Cod-2022@192.168.7.109:1688 file=a full=y
--导入：user
imp sys/Cod-2022@192.168.7.109:1688 file=a fromuser=user1
--导入：table
imp sys/Cod-2022@192.168.7.109:1688 file=a fromuser=user1 tables=test_lob1
例如：将桌面的test.txt文件导入到regress用户的xmltype_test表中。
./imp sys/Cod-2022@127.0.0.1:1688 file=/mnt/c/Users/yuanhaokun/Desktop/test.txt fromuser=regress tables=xmltype_test
 
 
--exp csv lls测试
 
导出：./exp --csv --format csv --user regress --password regress --tables xmltype_test --owner regress  --lob lls
导入：./yasldr regress/regress control_text="'load data OPTIONS(DEGREE_OF_PARALLELISM=3)  infile '/home/yuanhaokun/code/anchorbase/install/bin/xmltype_test' without embedded fields terminated by ',' discardmax 10 append into table xmltype_test(co1 lls)'"
 
--exp csv 非lls测试
 
导出：./exp --csv --format csv --user regress --password regress --tables xmltype_test --owner regress  --lob csv
导入：./yasldr regress/regress control_text="'load data OPTIONS(DEGREE_OF_PARALLELISM=3)  infile '/home/yuanhaokun/code/anchorbase/install/bin/xmltype_test' without embedded fields terminated by ',' discardmax 10 append into table xmltype_test(co1)'"


```

##   [7.资料设计章节](#7资料设计章节)  

  [lob（blob/clob） - 史鑫 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=95111467)  

  [global temporar table - 史鑫 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/display/~shixin/global+temporar+table)  