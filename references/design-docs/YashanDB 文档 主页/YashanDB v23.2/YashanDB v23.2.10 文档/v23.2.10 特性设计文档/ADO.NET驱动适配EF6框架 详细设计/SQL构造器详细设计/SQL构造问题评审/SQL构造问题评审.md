Created by 方少奎 on 八月 23, 2024

|问题|结果|
|---|---|
|In和Or表达式选择,目前对于In操作，均翻译成Or操作，是否有必要开启In操作支持？|  
|
|SQL需要在EF做嵌套展开？防止sql过于冗长。|  
|
|DbLambdaExpression|匿名表达式，无实际含义|
|DbTreatExpression|多态表达式，LINQ查询的类型转化，无数据库含义|
|DbRelationshipNavigationExpression|关系导航，描述实体与子实体之间的关系，无数据库含义，功能由DbJoinExpression替代|
|DbRefExpression|Ref，  用于处理实体间的关系，尤其是导航属性。|
|DbOfTypeExpression|OfType,用于处理多态的linq查询，  用于处理多态查询和类型转换  ，无数据库含义    
  var   dogs = context.Animals.OfType<Dog>().ToList();    
|
|DbIsOfExpression|IsOf,用于处理多态的linq查询，  用于在查询中应用类型过滤  ，无数据库含义    
  var   dogs = context.Animals .OfType<Dog>() .ToList();    
|
|DbRefKeyExpression|RefKey，表示两个实体之间的外键关系，用于对linq语法翻译，无数据库含义    
  var   orders = context.Orders .Where(o => o.Customer.CustomerName ==   "John Doe"  ) .ToList();    
|
|DbEntityRefExpression|```
Order
```|
|DbDerefExpression|解引用实际的实体对象，确保在查询中正确访问和使用实体数据。无数据库含义,var   orderDetails = context.Orders .Select(o =>   new   { o.OrderId, CustomerName = o.Customer.CustomerName }) .ToList();|


## Comments:

|  [](null)  ,支持IN表达式,Posted by fangshaokui at 八月 26, 2024 11:31|
|---|
|  [](null)  ,不做嵌套优化,Posted by fangshaokui at 八月 26, 2024 11:39|
