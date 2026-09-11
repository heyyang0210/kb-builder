  [https://pingcode.yasdb.com/pjm/items/67b7e1387ce85d5a0754017d?](https://pingcode.yasdb.com/pjm/items/67b7e1387ce85d5a0754017d?)  

#YDBRD-38318 支持geoserver 2.23.3版本的方言包



## 1. 总述

龙华政数局数字孪生平台需要使用geoserver工具2.23.3版本，所以要求崖山支持此版本，只要是要是需要适配 gt-jdbc方言包。

### 1.1 需求来源

   龙华政数局数字孪生平台

### 1.2 调研文档

  无

### 1.3 需求分析

1. 支持连接数据源为YashanDB。
1. 支持矢量数据。
1. 支持从YashanDB读取数据生成图层。
1. 图层支持Filter CQL


依赖环境：  
java版本11，geoserver版本2.23.3

### 1.4 数据字典

无

### 1.5 开源依赖

 无

## 2. 接口

无

## 3. 规格与约束

无

## 4. 特性

### 4.1 支持崖山数据源，发布图层:

1.  支持崖山数据源:修改类加载路径和geoserver一致。
1. 修改2.23.3版本种新增或者弃用的方法、类。
1. 修改2.23.3版本种原来变更的类名称，替换新的类名称。
1. 修改gt-jdbc的包名。
1. 适配新的gt-jdbc的CI工程包，和出包工程




### 4.2 图层支持filter CQL:

  [https://github.com/planetfederal/workshops/blob/master/workshops/geoserver/adv/doc/source/filtering/cqlogc.rst](https://github.com/planetfederal/workshops/blob/master/workshops/geoserver/adv/doc/source/filtering/cqlogc.rst)  

CQL的类型只要支持以下几种：

1.  比较运算，比较运算符有等于=、不等于<>、小于 <、小于等于<=、大于> 、大于等于>=。
1. BETWEEN AND值域区间，可过滤number类型的字段的值在某个区间。
1. LIKE值匹配，通过LIKE可对varchar和num等类型的字段进行过滤,其写法与SQL类似。
1.  IN条件，通过IN设置条件在某一组值中，可对varchar和num等类型的字段进行过滤
1. IS NULL，通过IS NULL设置条件判断值为空的要素，IS NOT NULL，通过IS NOT NULL设置条件判断值不为空的要素。
1. AND和OR，通过AND和OR可进行多条件组合进行过滤，AND表示多个条件同时满足，OR表示多个条件有一个满足。
1. EQ和NEQ，判断相等个不相等的要素。
1. 表达式作为过滤条件，如(num / 300) > 0.99表示num / 300运算的结果大于0.99的要素。
1. 空间过滤：


- INTERSECTS(Expression , Expression),相交判断
- DISJOINT(Expression , Expression),相离判断
- CONTAINS(Expression , Expression),CONTAINS(a, b)表示a包含b
- WITHIN(Expression , Expression)，WITHIN(a, b)表示a在b里面
- TOUCHES(Expression , Expression)，边界相交
- CROSSES(Expression , Expression)，交叉判断
- OVERLAPS(Expression , Expression) ，判断同一类型的要素是否有重叠
- RELATE(Expression , Expression , pattern)，相关联
- DWITHIN(Expression , Expression , distance , units)，表示将过滤向外扩一定距离的元素
- BEYOND(Expression , Expression , distance , units)，语法上跟DWITHIN一样，结果上刚好相反
- BBOX(Expression , Number , Number , Number , Number [ , CRS ] )，通过四至进行过滤，其中CRS为非必填参数，如bbox(GEOS, 106.55,28.86, 111.90,33.69)表示过滤四至在106.55,28.86, 111.90,33.69之内的要素。
- EQUALS(Expression , Expression) 两个几何对象完全相等




## 5. Testcases（自测用例）

1. geoserver支持崖山数据源
1. geoserver支持崖山图层数据
1. geoserver支持崖山发布图层
1. filter CQL支持以上需要支持的过滤。


## 7. 工作量评估

20人天

## 8.资料设计章节

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

## 9.未来规划

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。