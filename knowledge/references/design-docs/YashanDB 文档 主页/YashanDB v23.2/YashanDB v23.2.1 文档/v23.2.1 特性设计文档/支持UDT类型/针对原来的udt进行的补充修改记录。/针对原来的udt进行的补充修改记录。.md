Created by 张周玺, last modified on 十一月 28, 2023

查询获取的Struct里面的，raw()类型应该对应byte[].之前是ByteArrayInputStream类型，Oracle是byte[]。

  


Array.  getArray（）拿到的Struct里面包含的Struct类型，取不到最里层的udt类型。（array为objectType1类型的数组,objectType1里面包含objectType，取不到objectType的  SQLTypeName  ）

resultSet.getObject(  int   columnIndex  ,   java.util.Map<String  ,  Class<?>> map)实现有问题，支持不了嵌套。

Array.  getArray  (java.util.Map<String  ,  Class<?>> map)未实现。    
    


YasArray的  decode 方法里面元素的  dataSize计算有误，不应该是arrayData[index],而应该是getUdtSize(arrayData  ,   index)    
    


YasTypeDescriptor的  parentDescriptor字段没有意义，我删掉了。还有个原因是我想搞成缓存模式，就不用频繁读udt的metaData信息，一个udt可能被多个udt引用,它的parentDescriptor是不固定的，缓存下来的信息就可能是错的。    
    
    


YasStruct的  setFullTypeName方法我删掉了，  fullTypeName不应该允许set，因为Oracle也不允许，而且更重要的是咱们在插入的地方没有加针对这个name的校验，假如允许set，那用户设了一个错误的值之后咱们还是正常插进去就显得不合理了。    
    
    
  允许参数绑定SQLData类型的值，实现SQLOutPut的接口

  
