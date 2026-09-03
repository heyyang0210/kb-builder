Created by 徐晓锋, last modified by  陈芊宇 on 八月 04, 2023

IR：    [https://jira.yasdb.com/browse/YDBRD-150](https://jira.yasdb.com/browse/YDBRD-150)  

##   [1. Overview（概述）](#1-overview概述)  

本方案设计优化器支持生成Grouping Sets, Rollup, Cube的执行计划。

##   [2. Features（功能特性）](#2-features功能特性)  

Grouping Sets/Rollup/Cube的本次实现设计：执行实现Grouping sets，Rollup和Cube通过优化器拆分为union all Grouping sets操作的方式来实现。    
  Cube实现的是列的任意组合，如果有n个cube列，则生成的grouping sets的组合个数为2的n次方个。    
  Rollup实现的是列按照层次逐层分组，如果有n个rollup列，则生成的grouping sets的组合个数为n+1个（partial rollup产生n个）。    
  详细例子可以参考调研文档：    [https://conf.yasdb.com/pages/viewpage.action?pageId=109577164。](https://conf.yasdb.com/pages/viewpage.action?pageId=109577164%E3%80%82)  

后续如果执行实现cube或者rollup的执行算子，优化器可以不进行组合拆分。

##   [3. Interfaces（接口）](#3-interfaces接口)  

本方案无显式对外接口。

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

###   [4.1 group列个数规格限制：](#41-group列个数规格限制)  

长度无限制。常量在group by中有对应的优化，在grouping sets中当前版本未实现常量优化。

###   [4.2 group列限制：](#42-group列限制)  

Group列限制与普通group by一致。    
  Group by下推规则不适用于grouping sets场景（最下一层的group是可以支持下推的）。    
  汇聚函数带distinct的，distinct两阶段group改写规则，暂不支持grouping sets。

###   [4.3 汇聚函数：](#43-汇聚函数)  

sum，count, max, min    
  avg, stddev....    
  grouping function: NULL,subtotal

###   [4.4 改进与扩展：](#44-改进与扩展)  

如果执行将来实现rollup或者cube的算子，计划层将会增加新算子的表示，同时在当前实现扩展与新算子之间选择最优计划。    
  并行支持。

##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

###   [5.1 grouping表达式：](#51-grouping表达式)  

在parse和verify阶段，grouping sets，cube和rollup，都表示为expr list的方式。    
  grouping sets((c1,c2),c3))：    
  Expr: EXPR_GROUPING_SETS    
  Value->vExprList:    
  Expr: EXPR_EXPR_LIST: c1 -> c2    
  Expr: c3    
  Cube(c1, c2, c3)：    
  Expr: EXPR_CUBE    
  Value->vExprList:    
  Expr:c1    
  Expr:c2    
  Expr:c3    
  Rollup(c1, c2, c3):    
  Expr: EXPR_ROLLUP    
  Value->vExprList:    
  Expr:c1    
  Expr:c2    
  Expr:c3

因为list依赖Expr的next指针，在组合生成多个子集合时，如果继续使用list结构，需要多次拷贝表达式，并且修改next指针来组建新的list，内存开销增大且构建相对复杂，所以在优化阶段生成多个子集合时，直接采用object array的方式来存放表达式组合。执行时使用的结构为数组表示的表达式组合，增加如下两个结构体来分别表示Group by exprs。

typedef struct StGroupByExprs {    
  ObjectArray* gExprs;  // Exprs    
  } GroupByExprs;

typedef struct StGSetsExprs {    
  ObjectArray* gsExprs;  // GroupByExprs    
  CodBool      isMultiScan;} GSetsExprs;

###   [5.2 计划与算子路径规划：](#52-计划与算子路径规划)  

Grouping sets：  路径一：直接实现grouping sets算子，包括hash和sort两种方式。  路径二：将Grouping sets改写为group by union all的方式。Rollup：  路径一：直接实现Rollup算子，包括hash和sort两种方式。  路径二：Rollup改写为grouping sets的方式。Cube：  路径一：直接实现Cube算子，包括hash和sort两种方式。  路径二：Cube改写为rollup的方式。    
  路径可以递归实现，比如cube转为rollup, rollup又转为grouping sets。

###   [5.3 实现方法一：转为group by的方式，提取公共的group集合，采用逐层group的方式，将group的结果union在一起，生成最终结果集。举例如下：](#53-实现方法一转为group-by的方式提取公共的group集合采用逐层group的方式将group的结果union在一起生成最终结果集举例如下)  

grouping sets ((c1,c2),c3)    
  第一层：(c1,c2,c3),从原表取数据，执行group之前的所有操作，join，filter，rownum限制等，生成一个非汇聚的result结果集    
  第二层group: (c1,c2), 从第一层的result结果集取数据，生成一个新的group11结果集    
  (c3), 从第一层的result结果集取数据，生成一个新的group12结果集    
  最终将第二层group11 union all group12

rollup (c1,c2,c3)    
  第一层group：(c1,c2,c3),从原表取数据，执行group之前的所有操作，join，filter，rownum限制等，然后执行groupby生成一个group1结果集    
  第二层group: (c1,c2), 从第一层的group1结果集取数据，生成一个新的group2结果集    
  第三层group: (c1), 从第二层的group2结果集取数据，生成一个新的group3结果集    
  第四层group: (), 从第三层的group3结果集取数据，生成一个新的group4结果集    
  最终将第一层，第二层，第三层和第四层的group1 union all group2 union all group3 union all group4

cube(c1,c2,c3)    
  第一层group：(c1,c2,c3),从原表取数据，执行group之前的所有操作，join，filter，rownum限制等，然后执行groupby生成一个group1结果集    
  第二层group: (c1,c2), 从第一层的group1结果集取数据，生成一个新的group21结果集    
  (c1,c3), 从第一层的group1结果集取数据，生成一个新的group22结果集    
  (c2,c3), 从第一层的group1结果集取数据，生成一个新的group23结果集    
  第三层group: (c1), 从第二层的group21结果集取数据，生成一个新的group31结果集    
  (c2), 从第二层的group21结果集取数据，生成一个新的group32结果集    
  (c3), 从第二层的group22结果集取数据，生成一个新的group33结果集    
  第四层group: (), 从第三层的group31结果集取数据，生成一个新的group4结果集    
  最终将第一层，第二层，第三层和第四层的group1 union all group21 union all group22 union all group23 union all group31 union all group32 union all group33 union all group4

###   [5.2 实现方法二：将cube和rollup分拆为grouping sets的方式](#52-实现方法二将cube和rollup分拆为grouping-sets的方式)  

执行器实现grouping sets，优化器只处理拆分功能。由执行器实现grouping sets的执行能力。优化器可以按照执行器要求的最佳方式来排序grouping sets中的分组顺序，或者合并相同的分组，如果合并相同的分组，执行器在fetch阶段需要同样的结果集合fetch多遍或者引用相同的物化区，这个需要执行一起对齐表示方式。

###   [5.3 计划与算子实现：](#53-计划与算子实现)  

23.1中，确定方案如下：行列都实现grouping sets的算子，计划将rollup和cube转为grouping sets的方式来实现。    
  后续随着算子的逐步添加，路径可以逐步添加。    
  Grouping Sets，目前行列都先实现基于sort的grouping sets，计划上增加一个标志位，isMultiScan，来指导执行时，是一次扫描，保持多个物化区还是多次扫描，每次保持一个物化区的方式。sort grouping sets算子：    
  require sort目前设计为最多列的sort column， derived sort为null。    
  算子上挂一个grouping exprs，如果儿子计划产生的数据特征可以满足一些grouping sets的group操作，则会在该属性上挂这些列的组合，以便减少一些排序操作。    
  require 分布或者分区信息：    
  如果存在aggr(distinct ***)，目前到cn上执行。    
  如果不存在aggr(distinct ***)，实现基于数据流的两阶段grouping sets，基于分布键的一阶段，暂时无法实现。    
  require rescan: 设置为true。可能存在多次scan的算子，所以rescan设置为true。

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

##   [7.资料设计章节](#7资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

*说明本方案遗留的问题或下一步需要解决的问题。*