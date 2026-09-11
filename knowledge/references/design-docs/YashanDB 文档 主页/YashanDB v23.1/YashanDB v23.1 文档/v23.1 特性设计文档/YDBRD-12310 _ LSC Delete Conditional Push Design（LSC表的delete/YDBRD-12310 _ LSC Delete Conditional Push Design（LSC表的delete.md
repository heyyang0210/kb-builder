Created by 徐靖怡, last modified on 六月 07, 2023

## YDBRD-12310 : LSC Delete  Conditional Push Design（LSC表的delete条件下推（单机和分布式都要支持））

##   [1. Overview（概述）](https://conf.yasdb.com/pages/viewpage.action?pageId=100097050#1-overview%E6%A6%82%E8%BF%B0)  

条件下推的意义：将过滤条件下推给存储，存储根据过滤条件来执行过滤，直接得到符合条件的数据。

        以前是没有条件下推到存储的，执行一条语句“delete * from t1 where col1 > 3;”

是由存储提供col1这一列的所有数据给执行（Table Full Scan），然后执行将col1这一列的数据根据过滤条件（> 3）逐条过滤，最终得到符合条件的所有数据。

        能够实现条件下推到存储，则执行上述sql语句，

存储根据过滤条件直接将数据进行过滤，将符合条件的数据返回给执行。

##   [2. Features（功能特性）](https://conf.yasdb.com/pages/viewpage.action?pageId=100097050#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

条件下推的环境：单机+分布式

###   [1.单机环境下，支持生成“将过滤条件下推给存储”的计划。](https://conf.yasdb.com/pages/viewpage.action?pageId=100097050#1yasdb%E4%B8%AD%E7%9A%84guid%E4%B8%8Emssql%E4%B8%AD%E7%9A%84guid%E6%A0%BC%E5%BC%8F%E4%B8%8D%E5%AE%8C%E5%85%A8%E7%9B%B8%E5%90%8C)  

filter→acces

###   [2.单机环境下，支持传递列信息和过滤条件给存储](https://conf.yasdb.com/pages/viewpage.action?pageId=100097050#2guid%E8%BD%AC%E4%B8%BA%E5%B0%8F%E5%86%99)  

  将列数据和过滤条件装入AnFilterRange结构体中给存储来解析

typedef struct StCodFilterRange {    
  CodRangeType type;    
  CodUint32 count;    
  CodRangeValue values[0];    
  } CodFilterRange;

  


###   [3.](https://conf.yasdb.com/pages/viewpage.action?pageId=100097050#4%E5%8F%AF%E4%BB%A5%E4%BD%BF%E7%94%A8sys-guid%E5%87%BD%E6%95%B0%E5%9C%A8insert%E8%AF%AD%E5%8F%A5%E4%B8%AD%E7%94%9F%E6%88%90guid)      [分布式环境下，支持生成“将过滤条件下推给存储”的计划](https://conf.yasdb.com/pages/viewpage.action?pageId=100097050#3%E6%89%B9%E9%87%8F%E7%94%9F%E6%88%90guid)  

filter->access

###   [4.](https://conf.yasdb.com/pages/viewpage.action?pageId=100097050#5%E5%B0%86guid%E9%BB%98%E8%AE%A4%E5%8C%85%E5%90%AB%E5%9C%A8%E8%A1%A8%E7%9A%84create%E8%AF%AD%E5%8F%A5%E4%B8%AD%E6%95%B0%E6%8D%AE%E5%BA%93%E5%BD%93%E5%89%8D%E4%B8%8D%E6%94%AF%E6%8C%81raw%E7%B1%BB%E5%9E%8B%E4%BD%9C%E4%B8%BAprimary-key)      [分布式环境下，支持传递列信息和过滤条件给存储](https://conf.yasdb.com/pages/viewpage.action?pageId=100097050#3%E6%89%B9%E9%87%8F%E7%94%9F%E6%88%90guid)  

将列数据和过滤条件装入AnkFilterRange结构体中给存储来解析

typedef struct StCodFilterRange {    
  CodRangeType type;    
  CodUint32 count;    
  CodRangeValue values[0];    
  } CodFilterRange;

  


##   [3. Interfaces（接口）](https://conf.yasdb.com/pages/viewpage.action?pageId=100097050#3-interfaces%E6%8E%A5%E5%8F%A3)  

###   [1.plan侧生成rangeSet](https://conf.yasdb.com/pages/viewpage.action?pageId=100097050#1linux%E4%B8%8B%E4%BB%8Edevrandom%E8%8E%B7%E5%8F%96%E9%9A%8F%E6%9C%BA%E6%95%B0%E7%9A%84%E6%96%B9%E6%B3%95)  

pushPlanTableFilter  提取能够提出来的过滤条件和列信息，封装到rangeSet。并重新生成filter（重新生成的filter中不存在rangeSet了）。

findPushOnly  给提取出来的col（chain），打上标记。

计划生成在cboOpt→context  ，  optmzer.context，stmt→plancontext→plan都是同一个

stmt->planContext->plan→deletePlan.ds→rootPlan→tableScan.table→filter

  


新方案：

将pushPlanTableFilter函数提取到createTableFullScan层，让update和delete能够走到这里，将这个接口及内部函数改为行存和列存的公用接口。

###   [2.执行的准备阶段---将rangeSet的数据转为存储需要的类型](https://conf.yasdb.com/pages/viewpage.action?pageId=100097050#3%E6%A0%A1%E9%AA%8C%E4%B8%80%E4%B8%AA%E5%AD%97%E8%8A%82%E4%B8%AD%E7%9A%84%E4%B8%A4%E4%B8%AA%E6%95%B0%E6%8D%AE%E6%98%AF%E5%90%A6%E9%83%BD%E6%98%AF16%E8%BF%9B%E5%88%B6%E6%95%B0%E6%84%9F%E8%A7%89%E6%9C%89%E7%82%B9%E5%A4%9A%E4%BD%99)  

typedef struct StCodFilterRange {    
  CodRangeType type;    
  CodUint32 count;    
  CodRangeValue values[0];    
  } CodFilterRange;

  


//  将chain上的内容填充到CodFilterRange结构中；

CodResult rangeSetToFilterRange(PlanRangeChain* supportRangeSet,CodFilterRange** filterRange)

{

       //for循环，将chain上的所有range用for循环填充到CodFilterRange链表中

}

###   [3. 执行的准备阶段---类型判断](https://conf.yasdb.com/pages/viewpage.action?pageId=100097050#2-%E6%A0%A1%E9%AA%8C%E7%94%9F%E6%88%90%E7%9A%84giud%E7%9A%84%E6%98%AF%E5%90%A6%E6%9C%89%E6%95%88)  

判断当前rangeSet中的左右表达式的类型是否统一，或者是否能够通过类型转换后能统一，如果能，则挂在support，如果不能，则挂在unsupport

  


  


![](https://pingcode.yasdb.com/atlas/files/public/67396adba1ad9a3311dc7e1d/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0NBSUFJQUFJQUFBQUlBQUFBQVFBQUFBQUlBQUFBQkFBZ0FBSVFBQVFRQW9CQUFBZ0FBUVFBQUVBQUFDQVlBQUFBQUFRQUlCQUFBQUlDQUFBQUFBQkFRQUFBQUFBUUFDQUFCUUlBQUNJQUJBQUFBQUlBQUVBSUNBQkFBd0FnQUFBQ0FBQUFBQUFCQmdBQkFBQUFFQUFBQUFBQ0FJQkFBQUlCQVFDQUFEQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyODk1MTAsImV4cCI6MTc4MjMwMDMxMH0.3f6TVLKf5eyPaNz6B2Kft3u8u6X-o9iL83iMXbBkEmU)

rangeSet挂载的地方：stmt->planContext->plan→deletePlan.ds→rootPlan→tableScan.rangeSet

  


CodBool checkRangeConvTypeSupport（leftType,rightType）

{

    if(判断当前左右表达式的类型是否一致)

        {

            // 一致，则返回support中

        } else {

            //不一致

            if(判断是否能将右表达式的类型进行转换为左表达式)

            {

                //如果能，则将rightType改为右表达式的类型，返回support           

            } else {

                //如果不能，则返回unsupport

            }

       }

 }

  


CodResult getRealRangeSet（AnlPlan* plan, PlanTable* planTable）

{

    //创建supportRangeSet和unSupportRangeSet

    for(遍历rangeSet上的每个chain){

        for(遍历chain上的每个range) {

              //调用checkRangeConvType

             //返回support标记的放到supportRangeSet中，返回unsupport标记的放到unsupportRangeSet中

        }

    }

   for(遍历supportRangeSet上的每个chain){

       //调用rangeSetToFilterRange将support部分填入CodFilterRange链表中

      //调用存储的接口ankSetColumnFilter，进一步判断Chain，哪些是存储侧能过滤的，哪些是存储不能过滤的    

      //根据accept返回值，如果返回false，则将这个chain挂到unsupportRangeSet上

   }

   //将supportRangeSet挂在table上，由此得到realRangeSet

}

###   [4.执行的准备阶段---将rangeSet转为filter](https://conf.yasdb.com/pages/viewpage.action?pageId=100097050#4%E8%8E%B7%E5%8F%96windows%E4%B8%8B%E7%9A%84guid)  

CodResult rangeCombine(AnlStmt* stmt，AnlPlan* plan)

{

    for(遍历chain上的每个range) {

              调用filterConcat，将range用or挂在filter上

     }

}

CodResult rangeChainCombine(AnlStmt* stmt，AnlPlan* plan)

{

    for(遍历rangeSet上的每个chain) {

             调用filterCombine，将chain用and接在filter上

     }

}

CodResult rangeSetConvFilter(AnlStmt* stmt，AnlPlan* plan)

{

    调用rangeChainCombine，生成filter

    将filter挂在cursor上

}

###   [5.执行的准备阶段---准备rangeSet的总入口](https://conf.yasdb.com/pages/viewpage.action?pageId=100097050#5%E7%94%9F%E6%88%90guid)  

stmt->planContext->plan->deletePlan.ds→rootPlan→tableScan.table->cursor->attr.filter

CodResult prepareLscRangeSet(AnlStmt* stmt，AnlPlan* plan)

{

    1. if(不是lsc表) 退出

    2.调用getRealRangeSet函数来得到realRangeSet

    3.调用rangeCombine函数，用realRangeSet生成filterRs，挂在table->cursor->attr上

    4.调用rangeCombine函数，用unsupportRangeSet生成filterUnsupportRangeSet

    5.调用rangeCombine函数，将restFilter和filterUnsupportRangeSet合并

}

###   [6.执行的fetch阶段---修改调用的execFilter](https://conf.yasdb.com/pages/viewpage.action?pageId=100097050#5%E7%94%9F%E6%88%90guid)  

cursor->attr.filter

ankExecFilter =》handler->kernel->attr.callbackSet.execFilter=》     kcbExecFilter   =》execFilter =》execFilterNode =》execFilterEqual

CodResult     kcbExecFilter  （CodPointer hStmt, CodPointer filter, CodBool* isMatched）

{

    1.执行去除rangeSet的filter   原本的“COD_CALL(execFilter(hStmt, filter, &filterResult));”这句就是在执行filter，第2步要在这句后面进行判断并执行

    2.if(!  datasetIsFiltered)//判断存储在当前这条数据上是否真的做了过滤

       {

           COD_CALL(execFilter(hStmt, filterRangeSet, &filterResult));

       }

}

##   [4. Specification And Constraints（规格与约束）](https://conf.yasdb.com/pages/viewpage.action?pageId=100097050#4-specification-and-constraints%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

说明本方案对外的功能规格或约束。

**从设计、架构、功能内部耦合角度产生的约束，必须给出详细说明，用于支撑测试方案的灰盒测试。**

**结合《特性调研文档》，给出我们与竞品的差异点、优缺点描述。**

###   [1.只支持简单的delete的where过滤条件，不支持where中带有子查询的语句。](https://conf.yasdb.com/pages/viewpage.action?pageId=100097050#1%E4%B8%8D%E8%83%BD%E5%B0%86sys-guid%E4%BA%A7%E7%94%9F%E7%9A%84guid%E8%B5%8B%E5%80%BC%E7%BB%99int%E7%AD%89%E4%B8%8D%E5%8C%B9%E9%85%8D%E7%9A%84%E7%B1%BB%E5%9E%8B%E8%8B%A5%E8%B5%8B%E5%80%BC%E5%88%99%E6%8A%A5%E9%94%99)  

##   [5. Detail Design（详细设计）](https://conf.yasdb.com/pages/viewpage.action?pageId=100097050#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

###   [5.1 实现方法](https://conf.yasdb.com/pages/viewpage.action?pageId=100097050#511-%E5%AE%9E%E7%8E%B0%E6%96%B9%E6%B3%95%E4%B8%80%E5%B0%86%E5%A6%82%E4%B8%8B4%E7%A7%8D%E5%85%83%E7%B4%A0%E6%8B%BC%E6%8E%A5%E6%88%90%E4%B8%80%E4%B8%AAguid)  

![](https://pingcode.yasdb.com/atlas/files/public/67396adba1ad9a3311dc7e1e/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0NBSUFJQUFJQUFBQUlBQUFBQVFBQUFBQUlBQUFBQkFBZ0FBSVFBQVFRQW9CQUFBZ0FBUVFBQUVBQUFDQVlBQUFBQUFRQUlCQUFBQUlDQUFBQUFBQkFRQUFBQUFBUUFDQUFCUUlBQUNJQUJBQUFBQUlBQUVBSUNBQkFBd0FnQUFBQ0FBQUFBQUFCQmdBQkFBQUFFQUFBQUFBQ0FJQkFBQUlCQVFDQUFEQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyODk1MTAsImV4cCI6MTc4MjMwMDMxMH0.3f6TVLKf5eyPaNz6B2Kft3u8u6X-o9iL83iMXbBkEmU)

  


过滤方式讲解：

![](https://pingcode.yasdb.com/atlas/files/public/67396adba1ad9a3311dc7e1f/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0NBSUFJQUFJQUFBQUlBQUFBQVFBQUFBQUlBQUFBQkFBZ0FBSVFBQVFRQW9CQUFBZ0FBUVFBQUVBQUFDQVlBQUFBQUFRQUlCQUFBQUlDQUFBQUFBQkFRQUFBQUFBUUFDQUFCUUlBQUNJQUJBQUFBQUlBQUVBSUNBQkFBd0FnQUFBQ0FBQUFBQUFCQmdBQkFBQUFFQUFBQUFBQ0FJQkFBQUlCQVFDQUFEQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyODk1MTAsImV4cCI6MTc4MjMwMDMxMH0.3f6TVLKf5eyPaNz6B2Kft3u8u6X-o9iL83iMXbBkEmU)

  


  


###   [5.1.2方案选择](https://conf.yasdb.com/pages/viewpage.action?pageId=100097050#513%E6%96%B9%E6%A1%88%E9%80%89%E6%8B%A9)  

选择方案一。

###   [5.2 Data Structures & Flow（数据结构与流程）](https://conf.yasdb.com/pages/viewpage.action?pageId=100097050#52-data-structures--flow%E6%95%B0%E6%8D%AE%E7%BB%93%E6%9E%84%E4%B8%8E%E6%B5%81%E7%A8%8B)  

当前需求要做的所有内容

  


![](https://pingcode.yasdb.com/atlas/files/public/67396adba1ad9a3311dc7e20/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0NBSUFJQUFJQUFBQUlBQUFBQVFBQUFBQUlBQUFBQkFBZ0FBSVFBQVFRQW9CQUFBZ0FBUVFBQUVBQUFDQVlBQUFBQUFRQUlCQUFBQUlDQUFBQUFBQkFRQUFBQUFBUUFDQUFCUUlBQUNJQUJBQUFBQUlBQUVBSUNBQkFBd0FnQUFBQ0FBQUFBQUFCQmdBQkFBQUFFQUFBQUFBQ0FJQkFBQUlCQVFDQUFEQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyODk1MTAsImV4cCI6MTc4MjMwMDMxMH0.3f6TVLKf5eyPaNz6B2Kft3u8u6X-o9iL83iMXbBkEmU)

1.计划阶段，条件下推到存储的逻辑图

![](https://pingcode.yasdb.com/atlas/files/public/67396adb8970c2af4f51ffa7/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0NBSUFJQUFJQUFBQUlBQUFBQVFBQUFBQUlBQUFBQkFBZ0FBSVFBQVFRQW9CQUFBZ0FBUVFBQUVBQUFDQVlBQUFBQUFRQUlCQUFBQUlDQUFBQUFBQkFRQUFBQUFBUUFDQUFCUUlBQUNJQUJBQUFBQUlBQUVBSUNBQkFBd0FnQUFBQ0FBQUFBQUFCQmdBQkFBQUFFQUFBQUFBQ0FJQkFBQUlCQVFDQUFEQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyODk1MTAsImV4cCI6MTc4MjMwMDMxMH0.3f6TVLKf5eyPaNz6B2Kft3u8u6X-o9iL83iMXbBkEmU)

  


参考分布式列存的条件下推

![](https://pingcode.yasdb.com/atlas/files/public/67396adb8970c2af4f51ffa8/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0NBSUFJQUFJQUFBQUlBQUFBQVFBQUFBQUlBQUFBQkFBZ0FBSVFBQVFRQW9CQUFBZ0FBUVFBQUVBQUFDQVlBQUFBQUFRQUlCQUFBQUlDQUFBQUFBQkFRQUFBQUFBUUFDQUFCUUlBQUNJQUJBQUFBQUlBQUVBSUNBQkFBd0FnQUFBQ0FBQUFBQUFCQmdBQkFBQUFFQUFBQUFBQ0FJQkFBQUlCQVFDQUFEQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyODk1MTAsImV4cCI6MTc4MjMwMDMxMH0.3f6TVLKf5eyPaNz6B2Kft3u8u6X-o9iL83iMXbBkEmU)

2.delete的执行阶段的流程图

![](https://pingcode.yasdb.com/atlas/files/public/67396adba1ad9a3311dc7e21/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0NBSUFJQUFJQUFBQUlBQUFBQVFBQUFBQUlBQUFBQkFBZ0FBSVFBQVFRQW9CQUFBZ0FBUVFBQUVBQUFDQVlBQUFBQUFRQUlCQUFBQUlDQUFBQUFBQkFRQUFBQUFBUUFDQUFCUUlBQUNJQUJBQUFBQUlBQUVBSUNBQkFBd0FnQUFBQ0FBQUFBQUFCQmdBQkFBQUFFQUFBQUFBQ0FJQkFBQUlCQVFDQUFEQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyODk1MTAsImV4cCI6MTc4MjMwMDMxMH0.3f6TVLKf5eyPaNz6B2Kft3u8u6X-o9iL83iMXbBkEmU)

![](https://pingcode.yasdb.com/atlas/files/public/67396adb8970c2af4f51ffa9/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0NBSUFJQUFJQUFBQUlBQUFBQVFBQUFBQUlBQUFBQkFBZ0FBSVFBQVFRQW9CQUFBZ0FBUVFBQUVBQUFDQVlBQUFBQUFRQUlCQUFBQUlDQUFBQUFBQkFRQUFBQUFBUUFDQUFCUUlBQUNJQUJBQUFBQUlBQUVBSUNBQkFBd0FnQUFBQ0FBQUFBQUFCQmdBQkFBQUFFQUFBQUFBQ0FJQkFBQUlCQVFDQUFEQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyODk1MTAsImV4cCI6MTc4MjMwMDMxMH0.3f6TVLKf5eyPaNz6B2Kft3u8u6X-o9iL83iMXbBkEmU)

![](https://pingcode.yasdb.com/atlas/files/public/67396adb8970c2af4f51ffaa/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0NBSUFJQUFJQUFBQUlBQUFBQVFBQUFBQUlBQUFBQkFBZ0FBSVFBQVFRQW9CQUFBZ0FBUVFBQUVBQUFDQVlBQUFBQUFRQUlCQUFBQUlDQUFBQUFBQkFRQUFBQUFBUUFDQUFCUUlBQUNJQUJBQUFBQUlBQUVBSUNBQkFBd0FnQUFBQ0FBQUFBQUFCQmdBQkFBQUFFQUFBQUFBQ0FJQkFBQUlCQVFDQUFEQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyODk1MTAsImV4cCI6MTc4MjMwMDMxMH0.3f6TVLKf5eyPaNz6B2Kft3u8u6X-o9iL83iMXbBkEmU)

  


3.rs代码的流程图

![](https://pingcode.yasdb.com/atlas/files/public/67396adca1ad9a3311dc7e22/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0NBSUFJQUFJQUFBQUlBQUFBQVFBQUFBQUlBQUFBQkFBZ0FBSVFBQVFRQW9CQUFBZ0FBUVFBQUVBQUFDQVlBQUFBQUFRQUlCQUFBQUlDQUFBQUFBQkFRQUFBQUFBUUFDQUFCUUlBQUNJQUJBQUFBQUlBQUVBSUNBQkFBd0FnQUFBQ0FBQUFBQUFCQmdBQkFBQUFFQUFBQUFBQ0FJQkFBQUlCQVFDQUFEQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyODk1MTAsImV4cCI6MTc4MjMwMDMxMH0.3f6TVLKf5eyPaNz6B2Kft3u8u6X-o9iL83iMXbBkEmU)

4.filter在存储无法过滤的情况下的执行阶段进行过滤的流程图

![](https://pingcode.yasdb.com/atlas/files/public/67396adc8970c2af4f51ffab/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0NBSUFJQUFJQUFBQUlBQUFBQVFBQUFBQUlBQUFBQkFBZ0FBSVFBQVFRQW9CQUFBZ0FBUVFBQUVBQUFDQVlBQUFBQUFRQUlCQUFBQUlDQUFBQUFBQkFRQUFBQUFBUUFDQUFCUUlBQUNJQUJBQUFBQUlBQUVBSUNBQkFBd0FnQUFBQ0FBQUFBQUFCQmdBQkFBQUFFQUFBQUFBQ0FJQkFBQUlCQVFDQUFEQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyODk1MTAsImV4cCI6MTc4MjMwMDMxMH0.3f6TVLKf5eyPaNz6B2Kft3u8u6X-o9iL83iMXbBkEmU)

filter合并

![](https://pingcode.yasdb.com/atlas/files/public/67396adc8970c2af4f51ffac/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0NBSUFJQUFJQUFBQUlBQUFBQVFBQUFBQUlBQUFBQkFBZ0FBSVFBQVFRQW9CQUFBZ0FBUVFBQUVBQUFDQVlBQUFBQUFRQUlCQUFBQUlDQUFBQUFBQkFRQUFBQUFBUUFDQUFCUUlBQUNJQUJBQUFBQUlBQUVBSUNBQkFBd0FnQUFBQ0FBQUFBQUFCQmdBQkFBQUFFQUFBQUFBQ0FJQkFBQUlCQVFDQUFEQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyODk1MTAsImV4cCI6MTc4MjMwMDMxMH0.3f6TVLKf5eyPaNz6B2Kft3u8u6X-o9iL83iMXbBkEmU)

  


新方案：

![](https://pingcode.yasdb.com/atlas/files/public/67396adca1ad9a3311dc7e23/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0NBSUFJQUFJQUFBQUlBQUFBQVFBQUFBQUlBQUFBQkFBZ0FBSVFBQVFRQW9CQUFBZ0FBUVFBQUVBQUFDQVlBQUFBQUFRQUlCQUFBQUlDQUFBQUFBQkFRQUFBQUFBUUFDQUFCUUlBQUNJQUJBQUFBQUlBQUVBSUNBQkFBd0FnQUFBQ0FBQUFBQUFCQmdBQkFBQUFFQUFBQUFBQ0FJQkFBQUlCQVFDQUFEQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyODk1MTAsImV4cCI6MTc4MjMwMDMxMH0.3f6TVLKf5eyPaNz6B2Kft3u8u6X-o9iL83iMXbBkEmU)

  


###   [5.3 Compatibility（兼容性）](https://conf.yasdb.com/pages/viewpage.action?pageId=100097050#53-compatibility%E5%85%BC%E5%AE%B9%E6%80%A7)  

无

###   [5.4 DFX设计](https://conf.yasdb.com/pages/viewpage.action?pageId=100097050#54-dfx%E8%AE%BE%E8%AE%A1)  

1.在execTableFullScan做的类型判断、挂载到cursor、rangeSet转filter，那么所有调用这个函数的表都会走一遍这个过程，这个函数的使用既频繁又广泛，出问题则影响很大。

###   [5.5 其他](https://conf.yasdb.com/pages/viewpage.action?pageId=100097050#55-%E5%85%B6%E4%BB%96)  

无

##   [6. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=100097050#6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

--create table

单机：    
  create user regress identified by regress;    
  grant dba to regress;    
  drop table if exists area_lsc;    
  create table area_lsc (    
  area_no char(2) NOT NULL,    
  area_name varchar2(60),    
  dhq varchar2(20) default 'ShenZhen' NOT NULL    
  ) ORGANIZATION LSC;

insert into area_lsc values('3','0','3');    
  insert into area_lsc values('2','9','7');    
  insert into area_lsc values('3','1','6');    
  select * from area_lsc;    
  alter system set _ENABLE_ALTER_SLICE=true scope = memory;    
  alter table area_lsc alter slice all stable;    
  delete from area_lsc where area_no = '2';    
  update area_lsc set area_name = '100' where dhq = '6';

  


分布式：    
  drop table if exists area_lsc;    
  create table area_lsc (    
  area_no char(2) NOT NULL,    
  area_name varchar2(60),    
  dhq varchar2(20) default 'ShenZhen' NOT NULL    
  ) ORGANIZATION LSC;    
  insert into area_lsc values('1','10','12');    
  insert into area_lsc values('2','9','7');    
  insert into area_lsc values('3','1','6');    
  select * from area_lsc;    
  alter system set _ENABLE_ALTER_SLICE=true scope = memory type = all;    
  alter table area_lsc alter slice all stable;    
  delete from area_lsc where area_no = '2';

  


|测试用例|输出结果|执行计划（plan）|
|:---|:---|:---|
|  
|  
|  
|
|  
|  
|  
|


  


##   [7.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=100097050#7%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

无

##   [8. TODO（遗留问题）](https://conf.yasdb.com/pages/viewpage.action?pageId=100097050#8-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

## Attachments: