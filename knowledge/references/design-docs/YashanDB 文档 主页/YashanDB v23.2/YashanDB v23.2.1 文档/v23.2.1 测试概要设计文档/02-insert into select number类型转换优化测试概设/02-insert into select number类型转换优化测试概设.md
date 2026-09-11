Created by 贺天欢, last modified on 十一月 24, 2023

# **适用场景：IR关键特性的测试概要设计文档，用于SR测试设计参照**

IR链接：    [YDBRD-22366](https://jira.yasdb.com/browse/YDBRD-22366?src=confmacro)    -  insert into select number类型转换优化  验收中

开发设计文档：    [insert into select number类型转换优化](135615918.html)  

##   [1. 需求概述](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#1-%E9%9C%80%E6%B1%82%E6%A6%82%E8%BF%B0)  

相同的数据量，相同的环境， insert into select比oracle慢

统计了SQL执行和存储执行的时间发现，90%的时间都在SQL执行阶段，且Yashan的指令数明显高于Oralce。

分析Yashan的火焰图和函数调用堆栈发现，表达式执行的调用栈较深。

其次发现有很多的number类型的decode， encode调用，源表和目标表的number类型完全一致，存储格式是完全兼容的，存在冗余的decode， encode。

##   [2. 功能点](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#2-%E5%8A%9F%E8%83%BD%E7%82%B9)  

####   [1. 优化column expr](https://conf.yasdb.com/pages/viewpage.action?pageId=135615918#1-%E4%BC%98%E5%8C%96column-expr)  

在执行前先识别可以优化的表达式并申请这部分的执行态资源缓存，执行时将其直接从kernel table cursor上取column value，不经过表达式计算，借此来减少无需额外消耗的执行时间。

重点在于：

1）功能上，识别的可优化的表达式正确，当多表查询、表达式经过函数、group by\order by时则不优化，即不影响中间的调用和判断且最终执行结果正确；

     其他的单表查询且不经过函数、group by\order by的则会优化，结果正确且执行时间减少（执行时间只能大量数据时能观测到区别）；

2）  **性能上，大批量可优化的数据（比如源表行数9W，目标表列数88条）insert into select时，时间对比oracle相差不大（不超过5s？）**

####   [2. number转换优化](https://conf.yasdb.com/pages/viewpage.action?pageId=135615918#2-number%E8%BD%AC%E6%8D%A2%E4%BC%98%E5%8C%96)  

当源表对应列的number类型是可以在目标表内兼容时（即目标表的number(p,s)值域范围>=源表的number(p,s)值域范围），不经过CodNumber的中转直接按字节处理，借此来减少无需额外消耗的执行时间。

重点在于：

1）功能上，目标表的number(p,s)值域范围>=源表的number(p,s)值域范围的在insert into select后，查询目标表的值和源表一致；

     目标表的number(p,s)值域范围<源表的number(p,s)值域范围的在insert into select后，数值未超过目标表值域的值在查询目标表时按p、s正常截断，若数值超过目标表值域的值则插入失败

2）  **性能上，大批量互相兼容的number类型数据（比如源表行数9W，目标表列数88条）insert into select时，时间对比oracle相差不大（不超过5s？）**

PS.

1、列数会影响对内存的申请，是一个测试点；  行数是用来测试性能的；

因此测试时候要覆盖不同行列的不同量级的组合场景，注意列为4096列时也无法优化！！！。

2、select xx, func(xx) from table；这种是有区分的， xx能优化，func(xx)不能优化

##   [3. 规格约束](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#3-%E8%A7%84%E6%A0%BC%E7%BA%A6%E6%9D%9F)  

**只能优化源表与目标表是同类型的场景(同为行表，或者同为列表)**

22.2 只支持行表到行表

23.2 支持行表到行表，列表到列表

两个版本都不支持行表到列表或列表到行表的混合场景

**用于优化的内存申请不出来，不优化（比如4096列的表，app memory申请不出来空间）**

**只支持单表的select查询优化**

多表查询不支持优化

**只优化kernel column expr**

select sum(xx) from table; -- expr function

select id from table group by xx; -- expr mat column

##   [4. 主要应用场景](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#4-%E4%B8%BB%E8%A6%81%E5%BA%94%E7%94%A8%E5%9C%BA%E6%99%AF)  

*需求本身的主要应用场景：*

*对于可优化项和number数据类型的大批量数据，从源表insert into select number数据类型 from目标表，*  *覆盖不同量级时同样的环境和数据对比oracle的执行时间相差不超过5s*

*需求与其他特性的关联场景：*

*不影响不可优化项查询的正确性，不影响Number数据类型数值是否可存储的的正常判断*

##   [5. 概要测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#5-%E6%A6%82%E8%A6%81%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

###   [5.1 功能测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#51-%E5%8A%9F%E8%83%BD%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

一：22.2版本

根据上述两个功能点进行测试设计，重点测试大数据量下不同量级（不同行列组合情况）测试insert into select的执行时间，覆盖不同的场景：

1）单一可优化项非number数据类型场景            ------新包比老包执行时间缩短，和oracle基本一致

2）单一不可优化项非number数据类型场景     -----新包、老包执行时间基本一样没有缩短

3）混合项非number数据类型场景                    ------新包比老包执行时间缩短，但比oracle要长些

4）单一number数据类型可兼容场景            ------新包比老包执行时间短，和oracle基本一致

5）单一number数据类型不可兼容场景         -----新包、老包执行时间基本一样没有缩短

6）可兼容和不可兼容number类型混合场景         ------新包比老包执行时间缩短，但比oracle要长些

二：23.3版本

复用22.2的用例，但要补充lsc、tac的测试（测试点覆盖一样的）

###   [5.2 DFX测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#52-dfx%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

*不涉及*

##   [6. 测试策略](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#6-%E6%B5%8B%E8%AF%95%E7%AD%96%E7%95%A5)  

*测试覆盖策略：优先测试客户场景量级（源表行数9W，目标表列数88条）下可优化项和Number类型列的执行时间和oracle相差不超过5s，再覆盖其他量级，再测试混合场景，最后测试与其他特性的关联场景*

*测试框架满足度：guider可满足*

*自动化看护策略：算一个性能测试的需求，后面需要新增一个性能CI工程（放三层）看护*

##   [7. 后续关注(可选)](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#7-%E5%90%8E%E7%BB%AD%E5%85%B3%E6%B3%A8%E5%8F%AF%E9%80%89)  

22.2 只支持行表到行表

23.2 支持行表到行表，列表到列表  ----后续合入23.2时候注意要补充列表到列表（lsc\tac）的测试用例并测试

## Comments:

|  [](null)  ,做这些优化场景限制有几个原因：    
  1. 我们是通过把表达式跟对应的物理表绑定来达到优化效果的    
  限制单表：如果select查询是多表查询，例如select id from id union select id from t2， 取id列的表达式到了执行阶段，可能涉及两个表，没法唯一绑定到一个固定的表上，所以没法优化    
  group， order by：select id from table group by xx/ order by xx；这种取id列的表达式在执行的时候，是去物化区取值，并不是从物理表上直接取数据，所以没法优化    
  sum(xx)：这种从表达式角度，并不是一个取column value的表达式，而是一个聚合函数，肯定没法优化,Posted by hetianhuan at 十一月 24, 2023 16:37|
|---|
