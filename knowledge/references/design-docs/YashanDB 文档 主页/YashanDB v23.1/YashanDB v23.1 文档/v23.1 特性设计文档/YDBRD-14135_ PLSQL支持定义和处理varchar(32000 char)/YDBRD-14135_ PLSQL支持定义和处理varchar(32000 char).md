Created by 钟金健, last modified on 七月 17, 2023

IR:    [YDBRD-13899](https://jira.yasdb.com/browse/YDBRD-13899?src=confmacro)    -  PLSQL支持定义和处理varchar(32000 char)  完成

SR:    [YDBRD-14135](https://jira.yasdb.com/browse/YDBRD-14135?src=confmacro)    -  PLSQL支持定义和处理varchar(32000 char)  完成

##   [1. Overview（概述）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#1-overview%E6%A6%82%E8%BF%B0)  

目前yasdb已经支持在plsql中定义和使用varchar/char(n char)类型的变量，其中n的范围是1-8000。（前置SR    [YDBRD-7153](https://jira.yasdb.com/browse/YDBRD-7153?src=confmacro)    -  字符串类型size支持integer char语法  完成  ）

该sr目标是将n的范围从1-8000提升到1-32000。

##   [2. Features（功能特性）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

**定义范围**  ：理论上所有能定义char/varchar(32000)的地方都可以定义char/varchar(32000 char)

目前识别到的地方有

匿名块declare部分

record定义

自定义函数declare部分

等

**使用范围**  ：所有能使用char/varchar(32000 char)类型变量的地方都应该可以使用char/varchar(32000 char)类型变量

  


**验证变量类型的方式**

- create view v as select xxx from xxx;   desc v
- select typeof(xxx, 1) from xxx;    select typeof(xxx, 0) from xxx;


内置函数影响范围：

第一版调研文档，其结果仅供参考：    [ n char影响函数修改项整理 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=98507177)  

##   [3. Interfaces（接口）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#3-interfaces%E6%8E%A5%E5%8F%A3)  

##   [4. Specification And Constraints（规格与约束）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#4-specification-and-constraints%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

定义varchar(n char)可以放下n个字符，但是n个字符如果超过32000个字节时，数据依然不能暂存在变量中。

定义char(n char)可以放下n个字符，如果放入字符m个，添加n-m个空格，优先按照字符数，如果按照字符数补齐会超过32000字节，则只会补齐到32000字节。

##   [5. Detail Design（详细设计）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

在ExprNode上的dataTypeExt内添加charLen成员，当数据类型为字符串类型时(char/varchar)，charLen记录数据的字符长度。

在TypeDesc上也添加了charLen

  


解析阶段放开1-8000 char的限制。解析到char/varchar(n char)场景，TypeDesc的isChar标志位设置为true。

verify阶段传递isChar标志位，TypeDesc、ExprNode、ColumnAttr的isChar以及AnkColumn上的isCharacter上相互传递。同时在字符串的场景下要计算charLen

执行阶段对于typeof函数，对于isChar为true的节点要根据charLen打印其数据类型

##   [6. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

##   [7.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#7%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

##   [8. TODO（遗留问题）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#8-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

  
