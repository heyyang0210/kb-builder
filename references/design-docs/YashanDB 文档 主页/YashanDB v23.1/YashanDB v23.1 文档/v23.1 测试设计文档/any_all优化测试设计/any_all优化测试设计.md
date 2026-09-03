Created by 龚雯, last modified on 十月 31, 2023

# 1.   **概述**

描述any/all/some重写优化的测试设计

# 2.   **需求分析**

##   [2. Features（功能特性）](https://conf.yasdb.com/pages/viewpage.action?pageId=109592248#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

根据特性调研方案，可以得出以下结论：

1. Some为Any的同义词。
1. 当前只有比较运算符>、>=、<、<=、=、!= 这六种运算符可作为Any/All的左边运算符。
1. 当前比较运算符与Any/All 组合时，只支持标量比较，不支持向量比较(Oracle 亦是如此）。因而当子查询（或集合）必须为单列投影。


##   [3. Interfaces（接口）](https://conf.yasdb.com/pages/viewpage.action?pageId=109592248#3-interfaces%E6%8E%A5%E5%8F%A3)  

```
CodResult rewriteFilterAnyAll(<span class="hljs-name">AnlRewriter*</span> rwtr, FilterNode* node)<span class="hljs-comment" style="color: rgb(136,136,136);">;</span>

```

##   [4. Specification And Constraints（规格与约束）](https://conf.yasdb.com/pages/viewpage.action?pageId=109592248#4-specification-and-constraints%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

当前实现为运算符限定为 >、>=、<、<= 。

##   [5. Detail Design（详细设计）](https://conf.yasdb.com/pages/viewpage.action?pageId=109592248#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

###   [1. 运算符为Any运算符时且投影列中不含为aggr时，将any改写为min/max函数](https://conf.yasdb.com/pages/viewpage.action?pageId=109592248#1-%E8%BF%90%E7%AE%97%E7%AC%A6%E4%B8%BAany%E8%BF%90%E7%AE%97%E7%AC%A6%E6%97%B6%E4%B8%94%E6%8A%95%E5%BD%B1%E5%88%97%E4%B8%AD%E4%B8%8D%E5%90%AB%E4%B8%BAaggr%E6%97%B6%E5%B0%86any%E6%94%B9%E5%86%99%E4%B8%BAminmax%E5%87%BD%E6%95%B0)  

|比较运算符|Any|
|:---|:---|
|比较运算符|Any|
|>|min|
|>=|min|
|<|max|
|<=|max|


其中投影列数据集是否为NULL时，并不影响改写结果。 当子查询中不含有aggr函数时，在子查询投影列中增加min/max函数，将原投影列的expr做为函数参数，投影列属性(attr)则不变（即不改变原子查询的数据类型等信息） 当子查询含有为aggr函数时，则下述第2种方式改写。

```
     <span class="hljs-keyword">select</span> * <span class="hljs-keyword">from</span> t1 <span class="hljs-keyword">where</span> a1 &gt; <span class="hljs-keyword">any</span> (<span class="hljs-keyword">select</span> a2 <span class="hljs-keyword">from</span> t2);
 ==&gt; <span class="hljs-keyword">select</span> * <span class="hljs-keyword">from</span> t1 <span class="hljs-keyword">where</span> a1 &gt; (<span class="hljs-keyword">select</span> min(a2) <span class="hljs-keyword">from</span> t2);
   
     <span class="hljs-keyword">select</span> * <span class="hljs-keyword">from</span> t1 <span class="hljs-keyword">where</span> a1 &gt; <span class="hljs-keyword">any</span> (<span class="hljs-keyword">select</span> a2 <span class="hljs-keyword">from</span> t2 <span class="hljs-keyword">where</span> x1= x2);
 ==&gt; <span class="hljs-keyword">select</span> * <span class="hljs-keyword">from</span> t1 <span class="hljs-keyword">where</span> a1 &gt; (<span class="hljs-keyword">select</span> min(a2) <span class="hljs-keyword">from</span> t2 <span class="hljs-keyword">where</span> x1= x2);

```

除上述情况外，则按以下方式进行改写

###   [2. Any运算符改写为Semi join](https://conf.yasdb.com/pages/viewpage.action?pageId=109592248#2-any%E8%BF%90%E7%AE%97%E7%AC%A6%E6%94%B9%E5%86%99%E4%B8%BAsemi-join)  

```
     <span class="hljs-keyword">select</span> * <span class="hljs-keyword">from</span> t1 <span class="hljs-keyword">where</span> a1 &gt; <span class="hljs-keyword">any</span> (<span class="hljs-keyword">select</span> max(a2) <span class="hljs-keyword">from</span> t2);
 ==&gt; <span class="hljs-keyword">select</span> * <span class="hljs-keyword">from</span> t1, semi-<span class="hljs-keyword">join</span> (<span class="hljs-keyword">select</span> max(a2) <span class="hljs-keyword">from</span> t2) VSQ<span class="hljs-meta" style="color: rgb(31,113,153);">$1</span>@SEL<span class="hljs-meta" style="color: rgb(31,113,153);">$0</span> <span class="hljs-keyword">on</span> a1 &gt; VSQ<span class="hljs-meta" style="color: rgb(31,113,153);">$1</span>@SEL<span class="hljs-meta" style="color: rgb(31,113,153);">$0</span>.PROJ<span class="hljs-meta" style="color: rgb(31,113,153);">$0</span>;

```

有关联查询

```
     <span class="hljs-keyword">select</span> * <span class="hljs-keyword">from</span> t1 <span class="hljs-keyword">where</span> a1 &gt; <span class="hljs-keyword">any</span> (<span class="hljs-keyword">select</span> max(a2) <span class="hljs-keyword">from</span> t2 <span class="hljs-keyword">where</span> x1=x2);
 ==&gt; <span class="hljs-keyword">select</span> * <span class="hljs-keyword">from</span> t1, semi-<span class="hljs-keyword">join</span> (<span class="hljs-keyword">select</span> max(a2),x2 <span class="hljs-keyword">from</span> t2 <span class="hljs-keyword">group</span> <span class="hljs-keyword">by</span> x2) VSQ<span class="hljs-meta" style="color: rgb(31,113,153);">$1</span>@SEL<span class="hljs-meta" style="color: rgb(31,113,153);">$0</span> <span class="hljs-keyword">on</span> a1 &gt; VSQ<span class="hljs-meta" style="color: rgb(31,113,153);">$1</span>@SEL<span class="hljs-meta" style="color: rgb(31,113,153);">$0</span>.PROJ<span class="hljs-meta" style="color: rgb(31,113,153);">$0</span> <span class="hljs-keyword">and</span> x1= VSQ<span class="hljs-meta" style="color: rgb(31,113,153);">$1</span>@SEL$x2 ;

```

###   [3. All运算符改写为Anti join](https://conf.yasdb.com/pages/viewpage.action?pageId=109592248#3-all%E8%BF%90%E7%AE%97%E7%AC%A6%E6%94%B9%E5%86%99%E4%B8%BAanti-join)  

```
     <span class="hljs-keyword">select</span> * <span class="hljs-keyword">from</span> t1  <span class="hljs-keyword">where</span> a1 &gt; <span class="hljs-keyword">all</span> (<span class="hljs-keyword">select</span> a2 <span class="hljs-keyword">from</span> t2);
 ==&gt; <span class="hljs-keyword">select</span> * <span class="hljs-keyword">from</span> t1, anit-<span class="hljs-keyword">join</span> (<span class="hljs-keyword">select</span> a2 <span class="hljs-keyword">from</span> t2) VSQ<span class="hljs-meta" style="color: rgb(31,113,153);">$1</span>@SEL<span class="hljs-meta" style="color: rgb(31,113,153);">$0</span> <span class="hljs-keyword">on</span> a1 &lt;= VSQ<span class="hljs-meta" style="color: rgb(31,113,153);">$1</span>@SEL<span class="hljs-meta" style="color: rgb(31,113,153);">$0</span>.PROJ<span class="hljs-meta" style="color: rgb(31,113,153);">$0</span>;

```

有关联查询，则不进行改写。

```
    <span class="hljs-keyword">select</span> * <span class="hljs-keyword">from</span> t1 <span class="hljs-keyword">where</span> a1 &gt; <span class="hljs-keyword">all</span>(<span class="hljs-keyword">select</span> a2 <span class="hljs-keyword">from</span> t2 <span class="hljs-keyword">where</span> x1= x2);
==&gt; <span class="hljs-keyword">select</span> * <span class="hljs-keyword">from</span> t1, anit-<span class="hljs-keyword">join</span> (<span class="hljs-keyword">select</span> a2,x2 <span class="hljs-keyword">from</span> t2) VSQ<span class="hljs-meta" style="color: rgb(31,113,153);">$1</span>@SEL<span class="hljs-meta" style="color: rgb(31,113,153);">$0</span> <span class="hljs-keyword">on</span> a1 &lt;= VSQ<span class="hljs-meta" style="color: rgb(31,113,153);">$1</span>@SEL<span class="hljs-meta" style="color: rgb(31,113,153);">$0</span>.PROJ<span class="hljs-meta" style="color: rgb(31,113,153);">$0</span> <span class="hljs-keyword">and</span> x1= VSQ<span class="hljs-meta" style="color: rgb(31,113,153);">$1</span>@SEL<span class="hljs-meta" style="color: rgb(31,113,153);">$0</span>.PROJ<span class="hljs-meta" style="color: rgb(31,113,153);">$1</span> ;    

```

###   [改写公共限制条件](https://conf.yasdb.com/pages/viewpage.action?pageId=109592248#%E6%94%B9%E5%86%99%E5%85%AC%E5%85%B1%E9%99%90%E5%88%B6%E6%9D%A1%E4%BB%B6)  

1. 子查询必须为简单查询：即子查询不能为集合运算(union, minus等）或由此改写出来的View。通过查询子查询中dataset中的queryTable进行检查（由此扩展为CTE等)
1. 子关联查询不能含有rownum/limit、group by、窗口函数、aggr函数(?)。


# 3.   **测试设计方法**   

等价类划分

# 4.   **详细测试设计**

  


|输入条件|有效等价类|编号|备注|无效等价类|编号|备注|
|:---|:---|:---|:---|:---|:---|:---|
|子查询是否为集合运算|无集合运算|  
|  
|有集合运算|  
|不优化  |
|子查询是否有rownum/limit/groupby/窗口函数|无|  
|  
|有其中任意一个|  
|不优化|
|比较运算符|>|  
|  
|=|  
|不优化|
|  
|>=|  
|  
|!=|  
|不优化|
|  
|<|  
|  
|  
|  
|  
|
|  
|<=|  
|  
|  
|  
|  
|
|子查询是否为关联查询|关联子查询|  
|  
|  
|  
|  
|
|  
|关联孙子查询|  
|  
|  
|  
|  
|
|  
|100层嵌套关联查询|  
|  
|  
|  
|  
|
|  
|非关联子查询|  
|  
|  
|  
|  
|
|是否有聚合函数|any子查询有聚合|  
|改写为semi join|  
|  
|  
|
|  
|any子查询无聚合|  
|改写为min/max|  
|  
|  
|
|  
|all子查询有/无聚合|  
|  
|  
|  
|  
|
|子查询是否有空值拒绝|投影列有非空约束|  
|  
|  
|  
|  
|
|  
|有casewhen去除空值|  
|  
|  
|  
|  
|
|  
|有filter去除空值|  
|  
|  
|  
|  
|
|  
|没有空值拒绝|  
|  
|  
|  
|  
|
|子查询投影列个数|1|  
|  
|2|  
|有数据时报错，多列不优化|
|子查询组合|connect by|  
|  
|  
|  
|  
|
|  
|join|  
|  
|  
|  
|  
|
|  
|distinct|  
|  
|  
|  
|  
|
|  
|伪列|  
|  
|  
|  
|  
|
|投影列是否有索引|无索引|  
|  
|  
|  
|  
|
|  
|有普通索引|  
|  
|  
|  
|  
|
|  
|有分区索引|  
|  
|  
|  
|  
|


  


# 5.  ** 测试用例设计**

# 6.   **测试框架设计**

  


# 7.   **测试环境说明**

## Comments:

|  [](null)  ,1. 关注join时连接方式，若空值拒绝，可以把nl join优化为hash或merge join
1. 数据集结果，返回空集、全为空值、部分空值、无空值
1. 添加hint指定连接方式
1. 性能，参照sr内链接问题单
1. 测试优化开关
1. 多个子查询并列
1. 子查询和父查询中都有优化条件，只优化子查询（因为遇到view不优化）
1. 子查询组合orderby
1. 结合已有优化项
1. 行列均测试
1. some需要用例看护
1. 不同filter并列，不同filter嵌套，not in等，通过and、or连接
,Posted by gongwen at 五月 16, 2023 16:29|
|---|
