Created by 贺天欢, last modified on 十二月 12, 2023

IR链接：    [YDBRD-17259](https://jira.yasdb.com/browse/YDBRD-17259?src=confmacro)    -  ORACLE的语法兼容FLOAT(126)  完成

##   [1. 需求概述](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#1-%E9%9C%80%E6%B1%82%E6%A6%82%E8%BF%B0)  

SR描述：ORACLE的语法兼容FLOAT(126)，实际等于崖山中的FLOAT(53)。

规格范围：单机, 分布式, 集群。行、列表都支持。

##   [2. 功能点](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#2-%E5%8A%9F%E8%83%BD%E7%82%B9)  

float精度超过23自动转成double类型处理，原先超过53的报错改成现在不报错，上限改为126，超过126才报错，使Yasdb语法兼容Oracle的float(126)。

语法覆盖：

1.create table xx(col1 float(p));

##   [3. 规格约束](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#3-%E8%A7%84%E6%A0%BC%E7%BA%A6%E6%9D%9F)  

1、float精度只支持1~126，不在此范围的报错

2、当p超过53的时候，float内部会变成53

3、  不影响原有double的精度范围，不影响原有float(m,d)时的精度范围

##   [4. 主要应用场景](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#4-%E4%B8%BB%E8%A6%81%E5%BA%94%E7%94%A8%E5%9C%BA%E6%99%AF)  

*需求本身的主要应用场景：*

1、建表成功，float(p)时，插入总长度超过/不超过m值的数据，能正常插入，  存入的数据会四舍五入截断

2、0-23内，插入float列的数据类型  为float；

24-53内，插入float列的数据类型为double；

53-126内，插入float列的数据类型  为double(53)；

>126，报错提示合理范围是0 <= p <= 126

*需求与其他特性的关联场景：*

场景测试：

|输入条件|等价类|备注|
|:---|:---|---|
|DDL|最大规格定义时，create时作为列的默认值|  
|
|  
|最大规格定义时，alter时作为列的default默认值|  
|
|  
|最大规格定义时，作为分区键的key值|  
|
|Update|最大规格定义时，set、where覆盖左值和右值|  
|
|DQL 匿名块|最大规格定义时，在匿名块中|  
|
|导入导出|最大规格定义时，导入导出成功且数据一致|  
|
|高级包|最大规格定义时，dbms_metadata.get_ddl获取建表语句|  
|
|驱动|最大规格定义时，驱动正常|驱动可以协调驱动测试责任人去加用例|


##   [5. 概要测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#5-%E6%A6%82%E8%A6%81%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

###   [5.1 功能测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#51-%E5%8A%9F%E8%83%BD%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

*1.*  *主要采用的等价类划分，边界值，场景法组合及错误推测法进行设计*

*2.单机、*  *分布式、集群都支持，自动化用例在对应环境跑一遍*

*3、覆盖heap\tac\lsc*

###   [5.2 DFX测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#52-dfx%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

*不涉及*

##   [6. 测试策略](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#6-%E6%B5%8B%E8%AF%95%E7%AD%96%E7%95%A5)  

*测试覆盖策略：优先测试冒烟用例，再覆盖基本功能，场景部分最后测试*

*测试框架满足度：Guider+导入导出框架*

##   [7. 后续关注(可选)](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#7-%E5%90%8E%E7%BB%AD%E5%85%B3%E6%B3%A8%E5%8F%AF%E9%80%89)  

*依赖特性识别*

*后续测试详细设计中需要关注的内容*