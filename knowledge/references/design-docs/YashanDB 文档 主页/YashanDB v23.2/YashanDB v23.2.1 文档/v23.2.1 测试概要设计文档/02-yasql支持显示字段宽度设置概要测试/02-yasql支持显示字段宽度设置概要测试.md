Created by 贺天欢, last modified on 十二月 13, 2023

IR链接：    [YDBRD-21983](https://jira.yasdb.com/browse/YDBRD-21983?src=confmacro)    -  yasql支持显示字段宽度设置  完成

##   [1. 需求概述](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#1-%E9%9C%80%E6%B1%82%E6%A6%82%E8%BF%B0)  

需求范围：

单机,

需求来源：    
  数研所    
    
  需求场景：    
  数研所反馈yasql输出无法像oracle一样控制宽度，格式混乱。    
    
  需求描述：    
  yasql支持显示字段宽度设置（col xx format xx等）

##   [2. 功能点](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#2-%E5%8A%9F%E8%83%BD%E7%82%B9)  

*语法：*  *COL[UMN] *  *column*  * *  *|*  * *  *expr *  *FOR[MAT] *  *format*

*功能：*

1. 对字符列设置显示宽度
1. 对数值列设置显示宽度
1. 一次性清理对字符列和数值列的属性设置
1. 不带format子句时候列出全部同名列的属性


##   [3. 规格约束](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#3-%E8%A7%84%E6%A0%BC%E7%BA%A6%E6%9D%9F)  

1. *当前不支持的column语法的处理要报错提示*
1. *能否支持模糊匹配不同列，能否同时处理多个列*
1. *当前支持的字符类型范围，对不支持类型列的处理（select时显示#）*
1. *column和format关键字除了col和for是否还支持其他缩写，column\format\a大小写是否敏感，a和宽度n间是否允许空格*
1. *N的范围边界，超过前后边界值的处理，N的实际最大值受什么影响*
1. *对列和表达式匹配过程中，大小写是否敏感*
1. *字符列为左对齐显示，数值列为右对齐显示*
1. *不同字符集下（有些字符长度不一致），多字节字符（中文或者其他外文\表情包\特殊字符等）在单个字符超过宽度n设置时，截断显示乱码还是#还是报错（处理方式对齐oracle）*


##   [4. 主要应用场景](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#4-%E4%B8%BB%E8%A6%81%E5%BA%94%E7%94%A8%E5%9C%BA%E6%99%AF)  

*需求本身的主要应用场景：*

1. *column设置字符列、数值列是否正常影响到不同表中的全部同名列*
1. *清理col设置时是否同时清理全部表中的同名列*
1. 不带format子句时候列出全部同名列的属性
1. *不同表（heap\tac\lsc，临时表，不同用户所属表）拥有同名列时设置是否正常生效（注意用户权限问题）*


*需求与其他特性的关联场景：*

1. *对数值列设置宽度时要考虑和set numwidth xx的冲突，不一致时优先级谁更高*
1. *UDT类型时候的设置列宽度是否正常*
1. *列名和本次语法关键字重名时是否设置正常*
1. *建表时列名为双引号内带空格大小写，这种列名在column设置时是否正常*
1. *先column设置列宽度后，再更改对应列的数据类型的场景是否正常*


##   [5. 概要测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#5-%E6%A6%82%E8%A6%81%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

###   [5.1 功能测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#51-%E5%8A%9F%E8%83%BD%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

*1.*  *主要采用的等价类划分，边界值，场景法组合及错误推测法进行设计；*

*2.*  *根际开发实现原理覆盖主要应用场景：查询 表、视图、ac、统计信息等，可以控制显示格式，让显示结果清晰。*

*3.分布式、集群、列表不支持的特性，需要考虑补充拦截用例*

###   [5.2 DFX测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#52-dfx%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

*不涉及*

##   [6. 测试策略](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#6-%E6%B5%8B%E8%AF%95%E7%AD%96%E7%95%A5)  

*测试覆盖策略：优先冒烟测试点、再按level优先级覆盖功能点和其他场景*

*测试框架满足度：guider满足*

##   [7. 后续关注(可选)](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#7-%E5%90%8E%E7%BB%AD%E5%85%B3%E6%B3%A8%E5%8F%AF%E9%80%89)  

*依赖特性识别*

*后续测试详细设计中需要关注的内容*