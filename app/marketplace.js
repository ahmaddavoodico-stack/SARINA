const fa = {
 title:'بازارگاه کشاورزی سارینا', intro:'محصولات تولیدکنندگان و نهاده‌های تأمین‌کنندگان را در یک بازارگاه پیدا کنید.',
 farmer:'محصولات کشاورزان', company:'فروشگاه شرکت‌ها', cart:'سبد خرید', orders:'سفارش‌های من', seller:'پنل فروشنده',
 farmerHint:'محصول برداشت‌شده و تولیدی کشاورزان؛ از فروش محلی تا عرضه عمده.',
 companyHint:'کود، سم، بذر، نهال، تجهیزات آبیاری، ماشین‌آلات و فناوری کشاورزی.',
 search:'جست‌وجوی محصول یا فروشنده', all:'همه دسته‌ها', addCart:'افزودن به سبد', quote:'درخواست قیمت', noProducts:'هنوز محصول تأییدشده‌ای برای نمایش وجود ندارد.',
 sellerName:'نام فروشگاه یا مزرعه', sellerType:'نوع فروشنده', farmerSeller:'کشاورز تولیدکننده', companySeller:'شرکت / تأمین‌کننده',
 organization:'سازمان ثبت‌شده', registerSeller:'ثبت درخواست فروشندگی', pending:'در انتظار بررسی سارینا', verified:'تأییدشده', rejected:'ردشده', suspended:'تعلیق‌شده',
 sellerInfo:'اطلاعات فروشنده', productManage:'مدیریت محصولات', addProduct:'ثبت محصول جدید', productName:'نام محصول', category:'دسته‌بندی',
 description:'توضیحات', price:'قیمت واحد', currency:'ارز', unit:'واحد فروش', stock:'موجودی قابل عرضه', minQty:'حداقل سفارش', pricing:'روش قیمت‌گذاری',
 fixed:'قیمت مشخص', requestQuote:'استعلام قیمت', status:'وضعیت انتشار', draft:'پیش‌نویس', published:'منتشرشده', archived:'بایگانی',
 saveProduct:'ذخیره محصول', productsMine:'محصولات من', noSeller:'هنوز حساب فروشندگی ندارید.', sellerPending:'درخواست فروشندگی شما ثبت شده و پس از بررسی امکان انتشار کالا فعال می‌شود.',
 add:'افزودن', remove:'حذف', quantity:'تعداد', checkout:'ثبت سفارش برای این فروشنده', shippingName:'نام تحویل‌گیرنده', phone:'شماره تماس', address:'نشانی کامل', city:'شهر', country:'کشور', note:'توضیح برای فروشنده', placeOrder:'ثبت سفارش و صدور پیش‌نویس فاکتور',
 emptyCart:'سبد خرید خالی است.', orderCreated:'سفارش ثبت شد؛ پرداخت هنوز انجام نشده است.', orderError:'ثبت سفارش انجام نشد.', buyerOrders:'خریدهای من', sellerOrders:'سفارش‌های دریافتی', orderNo:'شماره سفارش', payment:'پرداخت', unpaid:'پرداخت‌نشده', pendingPay:'در انتظار پرداخت', paid:'پرداخت تأییدشده', fulfillment:'تحویل', notArranged:'هماهنگ نشده', preparing:'در حال آماده‌سازی', shipped:'ارسال‌شده', delivered:'تحویل‌شده',
 tracking:'اطلاعات ارسال', carrier:'شرکت حمل', trackingNo:'کد رهگیری', trackingUrl:'لینک رهگیری', updateShipment:'ثبت اطلاعات ارسال', waitingPayment:'اطلاعات ارسال پس از تأیید معتبر پرداخت فعال می‌شود.',
 quoteTitle:'درخواست استعلام قیمت', quoteMessage:'نیاز یا شرایط سفارش را توضیح دهید', sendQuote:'ارسال درخواست', quoteSent:'درخواست قیمت ارسال شد.', quoteError:'ارسال درخواست انجام نشد.',
 regulatory:'اطلاعات مجوز و مشخصات قانونی', regulated:'این محصول مشمول کنترل یا مجوز قانونی است', license:'شماره / مرجع مجوز', origin:'کشور یا منطقه تولید', grade:'درجه کیفیت', signIn:'برای استفاده از بازارگاه وارد حساب SARINA شوید.',
 taxNote:'پیش‌نویس فاکتور؛ وضعیت مالیات هنوز برای کشور فروشنده و خریدار بررسی نشده است.',
 oneSeller:'هر سفارش فقط برای یک فروشنده ثبت می‌شود. برای فروشندگان دیگر، سفارش جداگانه بسازید.',
 requestReview:'فروشنده تأییدنشده است؛ امکان خرید و انتشار عمومی وجود ندارد.',
};
const en = {
 title:'SARINA Agricultural Marketplace',intro:'Find farm produce and agricultural supplies in one marketplace.',
 farmer:'Farmers’ products',company:'Company store',cart:'Cart',orders:'My orders',seller:'Seller workspace',
 farmerHint:'Harvested and farm-produced goods, from local sales to wholesale supply.',
 companyHint:'Fertilizers, crop protection, seeds, seedlings, irrigation, machinery and ag-tech.',
 search:'Search products or sellers',all:'All categories',addCart:'Add to cart',quote:'Request a quote',noProducts:'No verified published products are available yet.',
 sellerName:'Farm or store name',sellerType:'Seller type',farmerSeller:'Farmer producer',companySeller:'Company / supplier',
 organization:'Registered organization',registerSeller:'Apply to become a seller',pending:'Pending SARINA review',verified:'Verified',rejected:'Rejected',suspended:'Suspended',
 sellerInfo:'Seller profile',productManage:'Product management',addProduct:'Add a product',productName:'Product name',category:'Category',
 description:'Description',price:'Unit price',currency:'Currency',unit:'Selling unit',stock:'Available stock',minQty:'Minimum order',pricing:'Pricing model',
 fixed:'Fixed price',requestQuote:'Request a quote',status:'Publication status',draft:'Draft',published:'Published',archived:'Archived',
 saveProduct:'Save product',productsMine:'My products',noSeller:'You do not have a seller profile yet.',sellerPending:'Your seller application is saved. Product publication becomes available after verification.',
 add:'Add',remove:'Remove',quantity:'Quantity',checkout:'Checkout with this seller',shippingName:'Recipient name',phone:'Phone',address:'Full address',city:'City',country:'Country',note:'Note to seller',placeOrder:'Place order and create invoice draft',
 emptyCart:'Your cart is empty.',orderCreated:'Order placed. Payment has not been made.',orderError:'Could not place the order.',buyerOrders:'My purchases',sellerOrders:'Incoming orders',orderNo:'Order number',payment:'Payment',unpaid:'Unpaid',pendingPay:'Awaiting payment',paid:'Payment confirmed',fulfillment:'Fulfillment',notArranged:'Not arranged',preparing:'Preparing',shipped:'Shipped',delivered:'Delivered',
 tracking:'Shipment details',carrier:'Carrier',trackingNo:'Tracking number',trackingUrl:'Tracking URL',updateShipment:'Save shipment details',waitingPayment:'Shipment entry is enabled after payment is validly confirmed.',
 quoteTitle:'Request a quote',quoteMessage:'Describe your needs or order conditions',sendQuote:'Send request',quoteSent:'Quote request sent.',quoteError:'Could not send the request.',
 regulatory:'Regulatory and license details',regulated:'This product is subject to regulatory controls',license:'License number / reference',origin:'Country or region of origin',grade:'Quality grade',signIn:'Sign in to your SARINA account to use the marketplace.',
 taxNote:'Invoice draft only. Tax treatment has not yet been reviewed for the buyer and seller jurisdictions.',
 oneSeller:'Each order belongs to one seller. Create separate orders for other sellers.',
 requestReview:'This seller is not verified; public publishing and checkout are unavailable.',
};
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = (v,cur,lang) => v==null ? '—' : new Intl.NumberFormat(lang==='fa'?'fa-IR':'en-US',{maximumFractionDigits:2}).format(Number(v))+' '+cur;
export function renderMarketplaceWorkspace(language='fa'){
 const w=language==='fa'?fa:en;
 return '<section class="marketplace-workspace"><div class="marketplace-heading"><div><span class="eyebrow">SARINA MARKETPLACE</span><h1>'+w.title+'</h1><p>'+w.intro+'</p></div><span class="marketplace-mark">🛒</span></div>'+
 '<nav class="market-tabs"><button type="button" data-market-tab="farmer_products" class="active">'+w.farmer+'</button><button type="button" data-market-tab="company_supplies">'+w.company+'</button><button type="button" data-market-tab="cart">'+w.cart+' <b data-cart-count>0</b></button><button type="button" data-market-tab="orders">'+w.orders+'</button><button type="button" data-market-tab="seller">'+w.seller+'</button></nav>'+
 '<div class="market-content" data-market-content><p>'+w.intro+'</p></div></section>';
}
export async function bindMarketplaceWorkspace({root,supabase,getProfile,getLanguage}){
 if(root.dataset.marketBound)return;root.dataset.marketBound='1';
 let activeTab='farmer_products',categories=[],sellerProfiles=[],cartRows=[];
 const w=()=>getLanguage()==='fa'?fa:en, lang=()=>getLanguage();
 const content=()=>root.querySelector('[data-market-content]');
 const profile=()=>getProfile();
 const setMessage=(el,msg)=>{const node=el?.querySelector('.market-message');if(node)node.textContent=msg;};
 const loadCategories=async()=>{const {data,error}=await supabase.from('marketplace_categories').select('*').eq('is_active',true).order('sort_order');if(error)throw error;categories=data||[];};
 const sellerStatus=s=>s?.verification_status==='verified'?w().verified:s?.verification_status==='rejected'?w().rejected:s?.verification_status==='suspended'?w().suspended:w().pending;
 async function loadCatalog(section){
  const rootEl=content();rootEl.innerHTML='<p class="market-loading">…</p>';
  const {data:products,error}=await supabase.from('marketplace_products').select('id,seller_id,category_id,market_section,name,description,specifications,pricing_model,price,currency,unit_label,minimum_order_qty,stock_qty,reserved_qty,origin_country,origin_region,quality_grade,regulated,license_reference,status').eq('market_section',section).eq('status','published').order('created_at',{ascending:false}).limit(100);
  if(error){rootEl.textContent=error.message;return;}
  const sellerIds=[...new Set((products||[]).map(p=>p.seller_id))];
  let sellers=[];
  if(sellerIds.length){const r=await supabase.from('marketplace_sellers').select('id,display_name,seller_type,region,city,verification_status').in('id',sellerIds);sellers=r.data||[];}
  const sellerMap=new Map(sellers.map(s=>[s.id,s]));
  const categoryMap=new Map(categories.map(c=>[c.id,c]));
  const cards=(products||[]).map(p=>{
   const s=sellerMap.get(p.seller_id),cat=categoryMap.get(p.category_id);
   const available=p.stock_qty==null?null:Number(p.stock_qty)-Number(p.reserved_qty||0);
   return '<article class="market-product-card"><div class="market-product-top"><span>'+esc(cat?(lang()==='fa'?cat.name_fa:cat.name_en):'')+'</span><span class="market-seller-kind">'+(section==='farmer_products'?'🌱':'🏢')+'</span></div><h3>'+esc(p.name)+'</h3><p>'+esc(p.description||'')+'</p><div class="market-product-meta"><span>'+esc(s?.display_name||'SARINA seller')+'</span><span>'+esc([s?.city,s?.region].filter(Boolean).join('، '))+'</span></div><div class="market-price">'+(p.pricing_model==='fixed'?money(p.price,p.currency,lang())+' / '+esc(p.unit_label):w().requestQuote)+'</div><small>'+w().quantity+': '+(available==null?'—':esc(available))+' '+esc(p.unit_label)+' · '+w().minQty+': '+esc(p.minimum_order_qty)+'</small><div class="market-product-actions">'+(p.pricing_model==='fixed'?'<button type="button" data-cart-add="'+p.id+'">'+w().addCart+'</button>':'<button type="button" data-quote-product="'+p.id+'" data-quote-seller="'+p.seller_id+'">'+w().quote+'</button>')+'</div><form class="market-quote-form hidden" data-quote-form="'+p.id+'"><textarea name="message" required placeholder="'+w().quoteMessage+'"></textarea><input name="quantity" type="number" min="0.01" step="0.01" placeholder="'+w().quantity+'"><button type="submit">'+w().sendQuote+'</button><p class="market-message"></p></form></article>';
  }).join('');
  rootEl.innerHTML='<div class="market-section-intro"><h2>'+(section==='farmer_products'?w().farmer:w().company)+'</h2><p>'+(section==='farmer_products'?w().farmerHint:w().companyHint)+'</p><input class="market-search" type="search" data-market-search placeholder="'+w().search+'"><select data-market-category><option value="">'+w().all+'</option>'+categories.filter(c=>c.market_section===section).map(c=>'<option value="'+c.id+'">'+esc(lang()==='fa'?c.name_fa:c.name_en)+'</option>').join('')+'</select></div><div class="market-product-grid">'+(cards||'<div class="market-empty">'+w().noProducts+'</div>')+'</div>';
  const search=rootEl.querySelector('[data-market-search]'),filter=rootEl.querySelector('[data-market-category]');
  const apply=()=>{const q=search.value.trim().toLowerCase(),cat=filter.value;[...rootEl.querySelectorAll('.market-product-card')].forEach((card,i)=>{const text=card.textContent.toLowerCase();card.classList.toggle('hidden',Boolean(q&&!text.includes(q))||Boolean(cat&&products[i]?.category_id!==cat));});};
  search.addEventListener('input',apply);
  filter.addEventListener('change',apply);
 }
 async function loadCart(){
  const p=profile();const {data,error}=await supabase.from('marketplace_cart_items').select('id,product_id,quantity').eq('buyer_user_id',p.id).order('created_at');
  if(error){content().textContent=error.message;return;}
  cartRows=data||[];root.querySelector('[data-cart-count]').textContent=String(cartRows.length);
  if(!cartRows.length){content().innerHTML='<div class="market-empty">'+w().emptyCart+'</div>';return;}
  const ids=cartRows.map(x=>x.product_id);
  const pr=await supabase.from('marketplace_products').select('id,seller_id,name,price,currency,unit_label,minimum_order_qty,stock_qty,reserved_qty,status').in('id',ids);
  const products=pr.data||[],pmap=new Map(products.map(x=>[x.id,x]));
  const sellerIds=[...new Set(products.map(x=>x.seller_id))];
  const sr=sellerIds.length?await supabase.from('marketplace_sellers').select('id,display_name').in('id',sellerIds):{data:[]};
  const smap=new Map((sr.data||[]).map(x=>[x.id,x]));
  const groups=new Map();
  cartRows.forEach(row=>{const product=pmap.get(row.product_id);if(!product)return;const key=product.seller_id;if(!groups.has(key))groups.set(key,[]);groups.get(key).push({row,product});});
  content().innerHTML='<h2>'+w().cart+'</h2><p>'+w().oneSeller+'</p>'+[...groups.entries()].map(([sellerId,items])=>'<section class="market-cart-group"><h3>'+esc(smap.get(sellerId)?.display_name||'Seller')+'</h3>'+items.map(({row,product})=>'<div class="market-cart-row"><div><b>'+esc(product.name)+'</b><small>'+money(product.price,product.currency,lang())+' / '+esc(product.unit_label)+'</small></div><input type="number" min="'+esc(product.minimum_order_qty)+'" step="0.01" value="'+esc(row.quantity)+'" data-cart-qty="'+row.id+'"><button type="button" data-cart-remove="'+row.id+'">'+w().remove+'</button></div>').join('')+'<form class="market-checkout-form" data-checkout="'+sellerId+'"><h4>'+w().checkout+'</h4><div class="market-form-grid"><label>'+w().shippingName+'<input name="recipient" required></label><label>'+w().phone+'<input name="phone" required></label><label>'+w().city+'<input name="city" required></label><label>'+w().country+'<input name="country" required></label><label class="market-wide">'+w().address+'<textarea name="address" required></textarea></label><label class="market-wide">'+w().note+'<input name="note"></label></div><button type="submit">'+w().placeOrder+'</button><p class="market-message"></p><small>'+w().taxNote+'</small></form></section>').join('');
 }
 async function loadOrders(){
  const p=profile(),buyer=await supabase.from('marketplace_orders').select('*').eq('buyer_user_id',p.id).order('placed_at',{ascending:false}).limit(30);
  const own=sellerProfiles.map(s=>s.id);let sales=[];
  if(own.length){const r=await supabase.from('marketplace_orders').select('*').in('seller_id',own).order('placed_at',{ascending:false}).limit(30);sales=r.data||[];}
  const all=[...(buyer.data||[]).map(o=>({...o,view:'buyer'})),...sales.filter(o=>!(buyer.data||[]).some(b=>b.id===o.id)).map(o=>({...o,view:'seller'}))];
  if(buyer.error){content().textContent=buyer.error.message;return;}
  if(!all.length){content().innerHTML='<div class="market-empty">—</div>';return;}
  const ids=all.map(o=>o.id),itemsR=await supabase.from('marketplace_order_items').select('*').in('order_id',ids),shipR=await supabase.from('marketplace_shipments').select('*').in('order_id',ids);
  const itemsMap=new Map();(itemsR.data||[]).forEach(i=>{if(!itemsMap.has(i.order_id))itemsMap.set(i.order_id,[]);itemsMap.get(i.order_id).push(i);});
  const shipMap=new Map((shipR.data||[]).map(s=>[s.order_id,s]));
  content().innerHTML='<h2>'+w().orders+'</h2>'+all.map(o=>'<article class="market-order-card"><div class="market-order-head"><b>'+w().orderNo+': '+esc(o.order_number)+'</b><span>'+money(o.total_amount,o.currency,lang())+'</span></div><p>'+w().payment+': '+(o.payment_status==='paid'?w().paid:w().unpaid)+' · '+w().fulfillment+': '+esc(o.fulfillment_status)+'</p><ul>'+((itemsMap.get(o.id)||[]).map(i=>'<li>'+esc(i.product_name_snapshot)+' × '+esc(i.quantity)+' — '+money(i.line_total,o.currency,lang())+'</li>').join(''))+'</ul>'+(shipMap.has(o.id)?'<small>'+w().tracking+': '+esc(shipMap.get(o.id).carrier_name||'')+' '+esc(shipMap.get(o.id).tracking_number||'')+'</small>':'')+(o.view==='seller'&&o.payment_status==='paid'?'<form class="market-shipment-form" data-shipment="'+o.id+'" data-seller="'+o.seller_id+'"><h4>'+w().tracking+'</h4><input name="carrier_name" placeholder="'+w().carrier+'"><input name="tracking_number" placeholder="'+w().trackingNo+'"><input name="tracking_url" type="url" placeholder="'+w().trackingUrl+'"><select name="status"><option value="preparing">'+w().preparing+'</option><option value="shipped">'+w().shipped+'</option><option value="delivered">'+w().delivered+'</option></select><button type="submit">'+w().updateShipment+'</button><p class="market-message"></p></form>':o.view==='seller'&&o.payment_status!=='paid'?'<small>'+w().waitingPayment+'</small>':'')+'</article>').join('');
 }
 async function loadSeller(){
  const p=profile();const r=await supabase.from('marketplace_sellers').select('*').eq('owner_user_id',p.id);
  if(r.error){content().textContent=r.error.message;return;}sellerProfiles=r.data||[];
  const existing=new Set(sellerProfiles.map(s=>s.seller_type));
  const missing=['farmer','company'].filter(t=>!existing.has(t));
  const orgs=missing.includes('company')?await supabase.from('organization_members').select('organization_id,organizations(display_name)').eq('user_id',p.id).eq('status','active'):{data:[]};
  const registration=missing.length?'<div class="market-seller-register"><h2>'+w().sellerInfo+'</h2><p>'+w().noSeller+'</p><form class="market-seller-form"><label>'+w().sellerType+'<select name="seller_type">'+missing.map(t=>'<option value="'+t+'">'+(t==='farmer'?w().farmerSeller:w().companySeller)+'</option>').join('')+'</select></label><label>'+w().sellerName+'<input name="display_name" required maxlength="180"></label><label class="market-org-field hidden">'+w().organization+'<select name="organization_id">'+(orgs.data||[]).map(o=>'<option value="'+o.organization_id+'">'+esc(o.organizations?.display_name||o.organization_id)+'</option>').join('')+'</select></label><button type="submit">'+w().registerSeller+'</button><p class="market-message"></p></form></div>':'';
  const blocks=[];
  for(const seller of sellerProfiles){
   const section=seller.seller_type==='farmer'?'farmer_products':'company_supplies';
   const products=await supabase.from('marketplace_products').select('*').eq('seller_id',seller.id).order('created_at',{ascending:false});
   const productMarkup=(products.data||[]).map(prod=>{
    const category=categories.find(cat=>cat.id===prod.category_id);
    const canPublish=seller.verification_status==='verified'&&prod.status==='draft'&&((!prod.regulated&&category?.code!=='crop_protection')||prod.regulatory_status==='verified');
    return '<div class="market-my-product"><b>'+esc(prod.name)+'</b><span>'+esc(w()[prod.status]||prod.status)+'</span>'+(canPublish?'<button type="button" data-publish="'+prod.id+'">'+w().published+'</button>':'')+'</div>';
   }).join('');
   blocks.push('<section class="market-seller-products"><div class="market-seller-status"><b>'+esc(seller.display_name)+'</b><span>'+sellerStatus(seller)+'</span></div>'+(seller.verification_status==='verified'?'':'<p class="market-note">'+w().sellerPending+'</p>')+'<h3>'+w().productManage+'</h3><form class="market-product-form" data-seller-id="'+seller.id+'"><label>'+w().productName+'<input name="name" required maxlength="220"></label><label>'+w().category+'<select name="category_id" required>'+categories.filter(cat=>cat.market_section===section).map(cat=>'<option value="'+cat.id+'">'+esc(lang()==='fa'?cat.name_fa:cat.name_en)+'</option>').join('')+'</select></label><label class="market-wide">'+w().description+'<textarea name="description"></textarea></label><label>'+w().pricing+'<select name="pricing_model"><option value="fixed">'+w().fixed+'</option><option value="request_quote">'+w().requestQuote+'</option></select></label><div class="market-fixed-fields"><label>'+w().price+'<input name="price" type="number" min="0.0001" step="0.0001"></label><label>'+w().currency+'<input name="currency" value="USD" maxlength="3" required></label><label>'+w().stock+'<input name="stock_qty" type="number" min="0" step="0.01"></label></div><label>'+w().unit+'<input name="unit_label" value="unit" required></label><label>'+w().minQty+'<input name="minimum_order_qty" type="number" min="0.01" step="0.01" value="1" required></label><label>'+w().origin+'<input name="origin_country"></label><label>'+w().grade+'<input name="quality_grade"></label><label class="market-check"><input type="checkbox" name="regulated" value="true"> '+w().regulated+'</label><label>'+w().license+'<input name="license_reference"></label><button type="submit">'+w().saveProduct+'</button><p class="market-message"></p></form><h3>'+w().productsMine+'</h3>'+(productMarkup||'<p class="market-empty">—</p>')+'</section>');
  }
  const quoteRows=sellerProfiles.length?await supabase.from('marketplace_quote_requests').select('*').in('seller_id',sellerProfiles.map(s=>s.id)).order('created_at',{ascending:false}).limit(30):{data:[]};
  const quoteMarkup=(quoteRows.data||[]).map(q=>'<article class="market-order-card"><b>'+w().quoteTitle+'</b><p>'+esc(q.message)+'</p><small>'+esc(q.status)+'</small>'+(q.status==='open'?'<form class="market-quote-response" data-quote-response="'+q.id+'"><textarea name="seller_response" required placeholder="'+w().quoteMessage+'"></textarea><button type="submit">'+w().sendQuote+'</button><p class="market-message"></p></form>':q.seller_response?'<p>'+esc(q.seller_response)+'</p>':'')+'</article>').join('');
  content().innerHTML=registration+blocks.join('')+(quoteMarkup?'<h3>'+w().quoteTitle+'</h3>'+quoteMarkup:'');
 }
 async function openTab(tab){
  activeTab=tab;root.querySelectorAll('[data-market-tab]').forEach(b=>b.classList.toggle('active',b.dataset.marketTab===tab));
  if(tab==='farmer_products'||tab==='company_supplies')await loadCatalog(tab);
  else if(tab==='cart')await loadCart();
  else if(tab==='orders')await loadOrders();
  else if(tab==='seller')await loadSeller();
 }
 root.addEventListener('click',async e=>{
  const tab=e.target.closest('[data-market-tab]');if(tab){openTab(tab.dataset.marketTab);return;}
  const add=e.target.closest('[data-cart-add]');if(add){const id=add.dataset.cartAdd,p=profile();const exists=await supabase.from('marketplace_cart_items').select('id,quantity').eq('buyer_user_id',p.id).eq('product_id',id).maybeSingle();const result=exists.data?await supabase.from('marketplace_cart_items').update({quantity:Number(exists.data.quantity)+1}).eq('id',exists.data.id):await supabase.from('marketplace_cart_items').insert({buyer_user_id:p.id,product_id:id,quantity:1});if(result.error){alert(result.error.message);return;}const count=await supabase.from('marketplace_cart_items').select('id',{count:'exact',head:true}).eq('buyer_user_id',p.id);root.querySelector('[data-cart-count]').textContent=String(count.count??0);add.textContent=w().add+' ✓';return;}
  const quote=e.target.closest('[data-quote-product]');if(quote){root.querySelector('[data-quote-form="'+quote.dataset.quoteProduct+'"]')?.classList.toggle('hidden');return;}
  const publish=e.target.closest('[data-publish]');if(publish){const {error}=await supabase.from('marketplace_products').update({status:'published',published_at:new Date().toISOString()}).eq('id',publish.dataset.publish);if(error){alert(error.message);return;}await loadSeller();return;}
  const remove=e.target.closest('[data-cart-remove]');if(remove){await supabase.from('marketplace_cart_items').delete().eq('id',remove.dataset.cartRemove);await loadCart();return;}
 });
 root.addEventListener('change',async e=>{
  const type=e.target.closest('[name="seller_type"]');if(type)content().querySelector('.market-org-field')?.classList.toggle('hidden',type.value!=='company');
  const pricing=e.target.closest('[name="pricing_model"]');if(pricing)content().querySelector('.market-fixed-fields')?.classList.toggle('hidden',pricing.value!=='fixed');
  const qty=e.target.closest('[data-cart-qty]');if(qty){const value=Number(qty.value);if(value>0){await supabase.from('marketplace_cart_items').update({quantity:value}).eq('id',qty.dataset.cartQty);await loadCart();}}
 });
 root.addEventListener('submit',async e=>{
  const sellerForm=e.target.closest('.market-seller-form');if(sellerForm){e.preventDefault();const v=Object.fromEntries(new FormData(sellerForm).entries());const p=profile();const payload={seller_type:v.seller_type,owner_user_id:p.id,display_name:v.display_name.trim()};if(v.seller_type==='company'){if(!v.organization_id){setMessage(sellerForm,w().requestReview);return;}payload.organization_id=v.organization_id;}const {error}=await supabase.from('marketplace_sellers').insert(payload);setMessage(sellerForm,error?error.message:w().sellerPending);if(!error)await loadSeller();return;}
  const productForm=e.target.closest('.market-product-form');if(productForm){e.preventDefault();const v=Object.fromEntries(new FormData(productForm).entries()),seller=sellerProfiles.find(s=>s.id===productForm.dataset.sellerId);if(!seller){setMessage(productForm,w().noSeller);return;}const fixed=v.pricing_model==='fixed';const payload={seller_id:seller.id,market_section:seller.seller_type==='farmer'?'farmer_products':'company_supplies',category_id:v.category_id,name:v.name.trim(),description:v.description||null,pricing_model:v.pricing_model,price:fixed?Number(v.price):null,currency:(v.currency||'USD').toUpperCase(),unit_label:v.unit_label,minimum_order_qty:Number(v.minimum_order_qty),stock_qty:fixed?Number(v.stock_qty):null,origin_country:v.origin_country||null,quality_grade:v.quality_grade||null,regulated:productForm.querySelector('[name="regulated"]').checked,license_reference:v.license_reference||null,status:'draft'};if(fixed&&(!Number.isFinite(payload.price)||payload.price<=0||!Number.isFinite(payload.stock_qty)||payload.stock_qty<0)){setMessage(productForm,w().price);return;}const {error}=await supabase.from('marketplace_products').insert(payload);setMessage(productForm,error?error.message:w().saveProduct+' ✓');if(!error)await loadSeller();return;}
  const quoteForm=e.target.closest('.market-quote-form');if(quoteForm){e.preventDefault();const id=quoteForm.dataset.quoteForm,card=quoteForm.closest('.market-product-card'),sellerId=card.querySelector('[data-quote-product="'+id+'"]').dataset.quoteSeller,v=Object.fromEntries(new FormData(quoteForm).entries());const {error}=await supabase.rpc('create_marketplace_quote_request',{p_seller_id:sellerId,p_product_id:id,p_quantity:v.quantity?Number(v.quantity):null,p_unit_label:null,p_message:v.message});setMessage(quoteForm,error?error.message:w().quoteSent);return;}
  const checkout=e.target.closest('.market-checkout-form');if(checkout){e.preventDefault();const v=Object.fromEntries(new FormData(checkout).entries()),address={recipient:v.recipient,phone:v.phone,address:v.address,city:v.city,country:v.country};const {data,error}=await supabase.rpc('create_marketplace_order',{p_seller_id:checkout.dataset.checkout,p_shipping_address:address,p_buyer_note:v.note||null});setMessage(checkout,error?error.message:w().orderError);if(!error){setMessage(checkout,w().orderCreated);await loadCart();}return;}
  const quoteResponse=e.target.closest('.market-quote-response');if(quoteResponse){e.preventDefault();const v=Object.fromEntries(new FormData(quoteResponse).entries());const {error}=await supabase.from('marketplace_quote_requests').update({status:'responded',seller_response:v.seller_response}).eq('id',quoteResponse.dataset.quoteResponse);setMessage(quoteResponse,error?error.message:w().quoteSent);if(!error)await loadSeller();return;}
  const shipment=e.target.closest('.market-shipment-form');if(shipment){e.preventDefault();const v=Object.fromEntries(new FormData(shipment).entries()),payload={order_id:shipment.dataset.shipment,seller_id:shipment.dataset.seller,carrier_name:v.carrier_name||null,tracking_number:v.tracking_number||null,tracking_url:v.tracking_url||null,status:v.status,shipped_at:v.status==='shipped'?new Date().toISOString():null,delivered_at:v.status==='delivered'?new Date().toISOString():null};const {error}=await supabase.from('marketplace_shipments').upsert(payload,{onConflict:'order_id'});setMessage(shipment,error?error.message:w().updateShipment+' ✓');return;}
 });
 await loadCategories();await openTab(activeTab);
}
