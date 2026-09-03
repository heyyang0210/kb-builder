Created by 刘清萍, last modified on 五月 13, 2024

##   [1. 需求概述](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#1-%E9%9C%80%E6%B1%82%E6%A6%82%E8%BF%B0)  

*需求来源：*  *南方电网POC*

*功能概述：*  *支持order by stop key算子*

*需求范围：单机*

  [https://pingcode.yasdb.com/pjm/items/6618a72dfd997db58ad7de53](https://pingcode.yasdb.com/pjm/items/6618a72dfd997db58ad7de53)    *?*  *  
*  *#YDBRD-26110 支持Order by上的stop key*

##   [2. 功能点](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#2-%E5%8A%9F%E8%83%BD%E7%82%B9)  

**使用场景**  ：一般来说，Stop Key 算子主要用于在有序索引上执行的查询。当查询涉及到有序索引时，数据库引擎可以利用 Stop Key 算子来优化查询执行过程，从而提高性能。

虽然 Stop Key 算子通常与有序索引相关联，但并不是说只有在列上有索引时才会使用。如果查询涉及到有序数据，但没有明确的索引支持，数据库仍然可以使用临时的排序操作来实现 Stop Key 的效果，尽可能减少扫描的数据量。

总的来说，索引可以加速查询，并且在使用 Stop Key 算子时通常是更高效的，但并不是唯一的使用场景。数据库系统会根据具体情况灵活选择最合适的优化方式来执行查询。

##   [3. 规格约束](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#3-%E8%A7%84%E6%A0%BC%E7%BA%A6%E6%9D%9F)  

  对齐oracle

##   [4. 主要应用场景](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#4-%E4%B8%BB%E8%A6%81%E5%BA%94%E7%94%A8%E5%9C%BA%E6%99%AF)  

*需求范围：*  *  
*  *1、单机（可能分布式也需要做） *

##   [5. 概要测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#5-%E6%A6%82%E8%A6%81%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

###   [5.1 功能测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#51-%E5%8A%9F%E8%83%BD%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

       1、关注能走到orderby stopkey的所有情况

       2、limit组合使用关注表现，多个limit查看表现

       3、绑定参数

       4、组合fetch 3 rows first语法

       5、作为整体 嵌套子查询，查看是否走orderby stopkey计划

       6、rownum来源考虑多种情况，from子查询中有rownum列 然后对此列和常量进行比较

       7、order by （const、表达式、子查询）

       8、分布式支持limit情况下 是否对分布式有影响

       9、关注索引是否对下推有影响

       10、计划对比oracle，关注执行结果是否正确



###   [5.2 DFX测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#52-dfx%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

关注ct/kt：下推和不下推场景并发

性能：下推后对性能的优化

##   [6. 测试策略](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#6-%E6%B5%8B%E8%AF%95%E7%AD%96%E7%95%A5)  

自动化看护

##   [7. 后续关注(可选)](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#7-%E5%90%8E%E7%BB%AD%E5%85%B3%E6%B3%A8%E5%8F%AF%E9%80%89)  

无

  
